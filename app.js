const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const helmet = require('helmet');
const app = express();
const PORT = process.env.PORT || 3000;

// Pasta para uploads
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

// Configura multer (upload de imagens/vídeos) com validação de tipo
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
      return cb(new Error('Apenas imagens e vídeos são permitidos'));
    }
    cb(null, true);
  }
});

// Funções auxiliares para leitura/gravação JSON
const CAROUSEL_FILE = path.join(__dirname, 'carousel_data.json');
function readCarousel() {
  if (!fs.existsSync(CAROUSEL_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CAROUSEL_FILE));
  } catch {
    return [];
  }
}
function saveCarousel(data) {
  fs.writeFileSync(CAROUSEL_FILE, JSON.stringify(data, null, 2));
}

// Escapar HTML para evitar XSS nas legendas
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => 
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
  );
}

// Middleware
app.use(helmet());
app.use('/uploads', express.static(UPLOADS));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque_essa_senha_secreta',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false } // ajuste secure: true se usar HTTPS
}));

// Credenciais do admin via env
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// Middleware de autenticação para /admin
function auth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.method === 'POST') {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      req.session.authenticated = true;
      return res.redirect('/admin');
    } else {
      return res.send(`
        <p>Usuário ou senha inválidos.</p>
        <a href="/admin">Voltar</a>
      `);
    }
  } else {
    res.send(`
      <form method="post">
        <input type="text" name="username" placeholder="Usuário" required autofocus />
        <input type="password" name="password" placeholder="Senha" required />
        <button>Entrar</button>
      </form>
    `);
  }
}

// Página pública
app.get('/', (req, res) => {
  const items = readCarousel();
  res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Single Coffee Carousel</title>
<style>
  body{font-family:sans-serif;margin:0;background:#fff;}
  .carousel{max-width:500px;margin:30px auto;box-shadow:0 0 12px #2222;padding:12px;border-radius:12px;background:#eee;}
  .carousel-item{display:none;flex-direction:column;align-items:center;}
  .carousel-item.active{display:flex;}
  img,video{max-width:100%;max-height:320px;border-radius:6px;}
  .caption{margin-top:10px;background:rgba(0,0,0,0.6);color:#fff;padding:6px 12px;border-radius:8px;}
  .controls{margin:10px;text-align:center;}
  .controls button{background:#333;color:#fff;border:none;padding:7px 13px;margin:0 5px;border-radius:6px;cursor:pointer;}
</style>
</head>
<body>
<div class="carousel">
${(items.length === 0) ? `<p>Nenhum item cadastrado no carrossel.</p>` : `
  ${items.map((item,i) => `
    <div class="carousel-item ${i===0 ? 'active' : ''}">
      ${item.type.startsWith('image') ?
        `<img src="${item.url}" alt="Foto"/>` :
        `<video src="${item.url}" controls></video>`
      }
      <div class="caption">${escapeHTML(item.caption)}</div>
    </div>
  `).join('')}
  <div class="controls">
    <button onclick="prev()">Anterior</button>
    <button onclick="next()">Próximo</button>
  </div>
`}
</div>
<script>
let idx=0;
const items=document.querySelectorAll('.carousel-item');
function show(n){
  if(!items.length) return;
  items[idx].classList.remove('active');
  idx=(n+items.length)%items.length;
  items[idx].classList.add('active');
}
function prev(){show(idx-1);}
function next(){show(idx+1);}
</script>
</body>
</html>`);
});

// Painel admin protegido
app.all('/admin', auth);

app.get('/admin', (req, res) => {
  const items = readCarousel();
  res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8"/>
  <title>Admin Carousel</title>
  <style>
  body{font-family:sans-serif;background:#f0f0f0;}
  .wrap{max-width:550px;margin:40px auto;padding:26px;background:#fff;border-radius:14px;box-shadow:0 1px 18px #4444;}
  h2{font-size:20px;}
  .item{display:flex;align-items:center;padding:7px 0;}
  .item img,.item video{max-width:50px;max-height:35px;margin-right:10px;}
  .item input[type=text]{flex:1 1 60%;padding:2px 8px;}
  .item button{margin-left:4px;}
  </style>
</head>
<body>
<div class="wrap">
  <h2>Painel Administrador – Carrossel multimídia</h2>
  <form action="/admin/upload" method="post" enctype="multipart/form-data">
    <input type="file" name="media" accept="image/*,video/*" required>
    <input type="text" name="caption" maxlength="128" placeholder="Legenda customizável">
    <button>Enviar</button>
  </form>
  <p>Itens atuais:</p>
  ${items.map((item, i) => `
    <div class="item">
      ${item.type.startsWith('image') ?
        `<img src="${item.url}" />` :
        `<video src="${item.url}" />`
      }
      <input type="text" value="${escapeHTML(item.caption)}" onchange="updateCaption(${i},this.value)">
      <button onclick="move(${i},-1)">↑</button>
      <button onclick="move(${i},1)">↓</button>
      <button onclick="remove(${i})" style="color:red;">Remover</button>
    </div>
  `).join('')}
  <form action="/admin/logout" method="post" style="margin-top:20px;">
    <button>Logout</button>
  </form>
</div>
<script>
function move(i,d){
  fetch('/admin/move', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({i,d})
  }).then(()=>location.reload());
}
function remove(i){
  if(!confirm('Remover item?'))return;
  fetch('/admin/remove', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({i})
  }).then(()=>location.reload());
}
function updateCaption(i,val){
  fetch('/admin/caption', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({i,caption:val})
  }).then(()=>location.reload());
}
</script>
</body>
</html>`);
});

// Upload de novo item
app.post('/admin/upload', auth, upload.single('media'), (req, res) => {
  if (!req.file) return res.send('Falha no upload');
  const data = readCarousel();
  data.push({
    url: '/uploads/' + req.file.filename,
    type: req.file.mimetype,
    caption: req.body.caption || ""
  });
  saveCarousel(data);
  res.redirect('/admin');
});

// Remover item
app.post('/admin/remove', auth, express.json(), (req, res) => {
  let data = readCarousel();
  const i = parseInt(req.body.i);
  if (data[i]) {
    const f = path.join(UPLOADS, path.basename(data[i].url));
    if (fs.existsSync(f)) fs.unlinkSync(f);
    data.splice(i, 1);
    saveCarousel(data);
  }
  res.send('OK');
});

// Mover item
app.post('/admin/move', auth, express.json(), (req, res) => {
  let data = readCarousel();
  const i = parseInt(req.body.i);
  const d = parseInt(req.body.d);
  if (data[i] && data[i + d]) {
    [data[i], data[i + d]] = [data[i + d], data[i]];
    saveCarousel(data);
  }
  res.send('OK');
});

// Editar legenda
app.post('/admin/caption', auth, express.json(), (req, res) => {
  let data = readCarousel();
  const i = parseInt(req.body.i);
  const cap = req.body.caption || "";
  if (data[i]) {
    data[i].caption = cap;
    saveCarousel(data);
  }
  res.send('OK');
});

// Logout
app.post('/admin/logout', auth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin');
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Sistema rodando em http://localhost:${PORT}`);
  console.log(`Acesse /admin para o painel administrativo`);
});
