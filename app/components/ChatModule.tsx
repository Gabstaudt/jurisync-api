"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ChatModule.module.css";

type Attachment = {
  fileName: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
};

type Conversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  participants: { id: string; name: string; email: string }[];
  lastMessage?: {
    id: string;
    senderId: string;
    content?: string;
    attachments?: Attachment[];
    createdAt: string;
  } | null;
  lastMessageAt: string;
  unreadCount: number;
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderName?: string;
  senderEmail?: string;
  content?: string;
  attachments: Attachment[];
  createdAt: string;
};

const formatWhen = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function ChatModule() {
  const [token, setToken] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("token") : "";
    if (stored) setToken(stored);
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoadingConversations(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao carregar conversas");
      setConversations(data);
      setSelectedId((current) => current ?? (data[0]?.id ?? null));
    } catch (e: any) {
      setError(e.message || "Erro ao buscar conversas");
    } finally {
      setLoadingConversations(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!token) return;
      setLoadingMessages(true);
      setError(null);
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falha ao carregar mensagens");
        setMessages(data);
      } catch (e: any) {
        setError(e.message || "Erro ao buscar mensagens");
      } finally {
        setLoadingMessages(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    } else {
      setMessages([]);
    }
  }, [loadMessages, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateConversation = async () => {
    if (!token) {
      setError("Informe o token de sessao (Authorization Bearer).");
      return;
    }
    if (!targetUserId.trim()) {
      setError("Informe o ID do destinatario.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ participantIds: [targetUserId.trim()] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conversa");
      setSelectedId(data.id);
      setTargetUserId("");
      await fetchConversations();
      await loadMessages(data.id);
      setInfo("Conversa criada");
    } catch (e: any) {
      setError(e.message || "Erro ao criar conversa");
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!token) {
      setError("Informe o token de sessao (Authorization Bearer).");
      return;
    }
    if (!selectedId) {
      setError("Selecione uma conversa.");
      return;
    }
    if (!newMessage.trim() && pendingFiles.length === 0) {
      setError("Mensagem vazia.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const uploaded: Attachment[] = [];
      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/chat/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao enviar arquivo");
        uploaded.push(json as Attachment);
      }

      const res = await fetch(`/api/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newMessage.trim(), attachments: uploaded }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar mensagem");

      setMessages((prev) => [...prev, data]);
      setNewMessage("");
      setPendingFiles([]);
      setInfo("Mensagem enviada");
      fetchConversations();
    } catch (e: any) {
      setError(e.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const unreadChip = (count: number) => {
    if (!count) return null;
    return <span className={styles.unread}>{count}</span>;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tokenBar}>
        <div className={styles.tokenField}>
          <label htmlFor="token">Token (Bearer)</label>
          <input
            id="token"
            placeholder="Cole o token retornado pelo login..."
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              if (typeof window !== "undefined") {
                localStorage.setItem("token", e.target.value);
              }
            }}
          />
        </div>
        <div className={styles.newConversation}>
          <label htmlFor="dest">Novo chat (ID do usuario)</label>
          <div className={styles.inline}>
            <input
              id="dest"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
            <button onClick={handleCreateConversation} disabled={creating}>
              {creating ? "Criando..." : "Iniciar"}
            </button>
          </div>
        </div>
      </div>

      {(error || info) && (
        <div className={error ? styles.error : styles.info}>
          {error || info}
        </div>
      )}

      <div className={styles.chatGrid}>
        <div className={styles.listColumn}>
          <div className={styles.listHeader}>
            <h4>Conversas</h4>
            {loadingConversations && <span className={styles.muted}>carregando...</span>}
          </div>
          <div className={styles.list}>
            {conversations.map((conv) => {
              const label =
                conv.title ||
                conv.participants
                  .map((p) => p.name || p.email || p.id.substring(0, 6))
                  .join(", ");
              const preview =
                conv.lastMessage?.content ||
                (conv.lastMessage?.attachments?.length ? "Arquivo enviado" : "Sem mensagens ainda");
              return (
                <button
                  key={conv.id}
                  className={`${styles.listItem} ${selectedId === conv.id ? styles.active : ""}`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div>
                    <div className={styles.itemTitle}>{label}</div>
                    <div className={styles.itemSub}>{preview}</div>
                  </div>
                  <div className={styles.itemMeta}>
                    <span>{formatWhen(conv.lastMessageAt)}</span>
                    {unreadChip(conv.unreadCount)}
                  </div>
                </button>
              );
            })}
            {!conversations.length && (
              <div className={styles.empty}>Nenhuma conversa encontrada.</div>
            )}
          </div>
        </div>

        <div className={styles.messagesColumn}>
          {selectedId ? (
            <>
              <div className={styles.messagesHeader}>
                <div>
                  <p className={styles.muted}>Mensagens</p>
                  <strong>{conversations.find((c) => c.id === selectedId)?.title || "Chat"}</strong>
                </div>
                {loadingMessages && <span className={styles.muted}>carregando...</span>}
              </div>
              <div className={styles.messages}>
                {messages.map((m) => (
                  <div key={m.id} className={styles.message}>
                    <div className={styles.messageMeta}>
                      <span>
                        {m.senderName ||
                          m.senderEmail ||
                          (m.senderId ? m.senderId.slice(0, 6) : "Usuario")}
                      </span>
                      <span className={styles.muted}>{formatWhen(m.createdAt)}</span>
                    </div>
                    {m.content && <p className={styles.messageBody}>{m.content}</p>}
                    {m.attachments?.length ? (
                      <div className={styles.attachments}>
                        {m.attachments.map((a) => (
                          <a key={a.filePath} href={a.filePath} target="_blank" rel="noreferrer">
                            {a.fileName || a.filePath}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {!messages.length && (
                  <div className={styles.empty}>Nenhuma mensagem ainda. Envie a primeira.</div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className={styles.composer}>
                <textarea
                  placeholder="Escreva sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                />
                <div className={styles.composerActions}>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={(e) => setPendingFiles(Array.from(e.target.files || []))}
                  />
                  {pendingFiles.length ? (
                    <div className={styles.filePreview}>
                      {pendingFiles.map((f) => (
                        <span key={f.name}>{f.name}</span>
                      ))}
                    </div>
                  ) : null}
                  <button onClick={handleSendMessage} disabled={sending}>
                    {sending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className={styles.emptyPane}>Selecione ou crie uma conversa.</div>
          )}
        </div>
      </div>
    </div>
  );
}
