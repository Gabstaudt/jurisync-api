# Este repositório contém o backend (API) do JuriSync, responsável por toda a lógica de negócio, persistência de dados e regras do sistema jurídico.

A API centraliza o gerenciamento de processos, contratos e dados jurídicos, fornecendo endpoints seguros para consumo pelo frontend.

## Objetivo da API

Gerenciar processos jurídicos
Gerenciar contratos
Centralizar regras de negócio
Fornecer dados ao frontend via API REST
Garantir organização e integridade das informações

## Funcionalidades da API

CRUD de processos
CRUD de contratos
Estrutura para autenticação e permissões
Validação de dados
Comunicação com banco de dados

## Como rodar a API
### Pré-requisitos
Node.js (LTS)
Banco de dados configurado (PostgreSQL/MySQL)
npm ou yarn

### Passos
git clone https://github.com/seu-usuario/jurisync-api.git
cd jurisync-api
npm install
npm run dev

A API será iniciada, por padrão, em:

http://localhost:3001
### Integração com o Frontend

O frontend do JuriSync consome esta API para:
Listar processos
Listar contratos
Criar, editar e remover registros
Atualizar informações jurídicas

 ## Observações Importantes

Este projeto representa somente o servidor
O sistema não substitui profissionais jurídicos
Projeto voltado para gestão e apoio operacional
