import styles from "./page.module.css";
import ChatModule from "./components/ChatModule";

export default function Home() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Ecossistema colaborativo</p>
          <h1>Centralize contratos e conversas internas.</h1>
          <p className={styles.lead}>
            O novo modulo de chat permite mensagens privadas entre usuarios do mesmo
            ecossistema, com anexos e registro cronologico.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#chat">
              Abrir chat
            </a>
            <a className={styles.secondary} href="#folders">
              Ver pastas
            </a>
          </div>
        </div>
        <div className={styles.snapshot}>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Status</p>
            <strong className={styles.cardValue}>Online</strong>
            <p className={styles.cardSub}>Sessao ativa pronta para mensagens.</p>
          </div>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Seguranca</p>
            <strong className={styles.cardValue}>Privado</strong>
            <p className={styles.cardSub}>Apenas usuarios do mesmo ecossistema.</p>
          </div>
          <div className={styles.card}>
            <p className={styles.cardLabel}>Anexos</p>
            <strong className={styles.cardValue}>Uploads locais</strong>
            <p className={styles.cardSub}>Arquivos guardados em /public/uploads/chat.</p>
          </div>
        </div>
      </section>

      <section id="chat" className={styles.chatSection}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Modulo de chat</p>
            <h2>Mensagens privadas com anexos</h2>
            <p className={styles.sub}>
              Use seu token de sessao (Bearer) para listar conversas, enviar mensagens e anexar arquivos.
            </p>
          </div>
        </div>
        <ChatModule />
      </section>
    </div>
  );
}
