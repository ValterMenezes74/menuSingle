# MenuSingle

Carrossel multimídia simples com painel administrativo para upload e gerenciamento de imagens e vídeos.

## Instalação

```bash
npm install
```

## Variáveis de ambiente recomendadas

- `PORT` - Porta para rodar o servidor (padrão 3000)
- `ADMIN_USER` - Usuário admin para login (padrão "admin")
- `ADMIN_PASS` - Senha do admin para login (padrão "admin123")
- `SESSION_SECRET` - Segredo para sessão (mude para algo seguro)

## Executar

```bash
npm start
```

## Deploy no Render

- Configure as variáveis de ambiente no painel do Render conforme acima.
- Não esqueça de criar o serviço Web apontando para esse repositório.

## Funcionalidades

- Upload de imagens e vídeos com legenda
- Ordenação, remoção e edição de legendas
- Interface pública para exibir carrossel
- Autenticação segura via sessão
- Proteção básica com Helmet

