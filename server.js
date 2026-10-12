require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ SERVIDOR DE ARQUIVOS ESTÁTICOS DO FRONTEND
app.use(express.static(path.join(__dirname, 'frontand')));

// Variável global para o banco de dados
let db;

// ===== FUNÇÃO PARA INICIALIZAR BANCO =====
async function initDatabase() {
  try {
    // ✅ CORREÇÃO PARA RENDER: usar DB_PATH se definido
    let dbPath;

    if (process.env.DB_PATH) {
      dbPath = process.env.DB_PATH;
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    } else {
      const dbDir = path.join(__dirname, 'database');
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      dbPath = path.join(dbDir, 'edupage.db');
    }

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('✅ Conectado ao banco SQLite em:', dbPath);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        tipo TEXT CHECK(tipo IN ('admin', 'professor', 'aluno', 'pai')) NOT NULL,
        foto TEXT,
        telefone TEXT,
        data_nascimento DATE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        ano INTEGER NOT NULL,
        turno TEXT CHECK(turno IN ('manha', 'tarde', 'noite')) NOT NULL,
        professor_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS disciplinas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        codigo TEXT UNIQUE NOT NULL,
        carga_horaria INTEGER DEFAULT 60,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS matriculas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        ano_letivo INTEGER NOT NULL,
        status TEXT CHECK(status IN ('ativa', 'concluida', 'cancelada')) DEFAULT 'ativa',
        data_matricula DATE DEFAULT CURRENT_DATE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
        UNIQUE(aluno_id, turma_id, ano_letivo)
      );

      CREATE TABLE IF NOT EXISTS notas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        disciplina_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        trimestre INTEGER CHECK(trimestre BETWEEN 1 AND 3) NOT NULL,
        tipo_avaliacao TEXT CHECK(tipo_avaliacao IN ('ACS1', 'ACS2', 'AT')) NOT NULL,
        nota DECIMAL(4,2) CHECK(nota >= 0 AND nota <= 20),
        data_lancamento DATE DEFAULT CURRENT_DATE,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
        UNIQUE(aluno_id, disciplina_id, turma_id, trimestre, tipo_avaliacao)
      );

      CREATE TABLE IF NOT EXISTS presencas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        disciplina_id INTEGER,
        data DATE NOT NULL,
        presente BOOLEAN DEFAULT 1,
        justificativa TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (aluno_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
        UNIQUE(aluno_id, turma_id, disciplina_id, data)
      );

      CREATE TABLE IF NOT EXISTS tpc (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        descricao TEXT,
        disciplina_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        professor_id INTEGER NOT NULL,
        data_entrega DATE NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id) ON DELETE CASCADE,
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE,
        FOREIGN KEY (professor_id) REFERENCES usuarios(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tpc_entregas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tpc_id INTEGER NOT NULL,
        aluno_id INTEGER NOT NULL,
        entregue BOOLEAN DEFAULT 0,
        data_entrega DATETIME,
        nota DECIMAL(4,2) CHECK(nota >= 0 AND nota <= 20),
        comentario TEXT,
        marcado_por INTEGER,
        marcado_professor BOOLEAN DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tpc_id) REFERENCES tpc(id) ON DELETE CASCADE,
        FOREIGN KEY (aluno_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (marcado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
        UNIQUE(tpc_id, aluno_id)
      );

      CREATE TABLE IF NOT EXISTS mensagens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remetente_id INTEGER NOT NULL,
        destinatario_id INTEGER,
        turma_id INTEGER,
        assunto TEXT NOT NULL,
        conteudo TEXT NOT NULL,
        lida BOOLEAN DEFAULT 0,
        data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (turma_id) REFERENCES turmas(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pais_alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pai_id INTEGER NOT NULL,
        aluno_id INTEGER NOT NULL,
        parentesco TEXT DEFAULT 'pai',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pai_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (aluno_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        UNIQUE(pai_id, aluno_id)
      );

      CREATE TABLE IF NOT EXISTS professor_disciplina_turma (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professor_id INTEGER NOT NULL,
        disciplina_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        ano_letivo INTEGER NOT NULL,
        carga_horaria INTEGER DEFAULT 2,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES usuarios(id),
        FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
        FOREIGN KEY (turma_id) REFERENCES turmas(id),
        UNIQUE(professor_id, disciplina_id, turma_id, ano_letivo)
      );
    `);

    console.log('✅ Tabelas criadas/verificadas com sucesso');

    // Criar admin padrão
    const admin = await db.get('SELECT * FROM usuarios WHERE email = ?', ['admin@escola.com']);
    if (!admin) {
      const senhaHash = await bcrypt.hash('admin123', 10);
      await db.run(
        `INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
        ['Administrador', 'admin@escola.com', senhaHash, 'admin']
      );
      console.log('✅ Admin criado: admin@escola.com / admin123');
    }

    // Criar professor padrão
    const professor = await db.get('SELECT * FROM usuarios WHERE email = ?', ['professor@escola.com']);
    if (!professor) {
      const senhaHash = await bcrypt.hash('prof123', 10);
      await db.run(
        `INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
        ['Professor Carlos', 'professor@escola.com', senhaHash, 'professor']
      );
      console.log('✅ Professor criado: professor@escola.com / prof123');
    }

    // Criar pai padrão
    const pai = await db.get('SELECT * FROM usuarios WHERE email = ?', ['pai@escola.com']);
    if (!pai) {
      const senhaHash = await bcrypt.hash('pai123', 10);
      await db.run(
        `INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
        ['António Silva', 'pai@escola.com', senhaHash, 'pai']
      );
      console.log('✅ Pai criado: pai@escola.com / pai123');
    }

    // Criar disciplinas padrão
    const disciplinas = await db.all('SELECT * FROM disciplinas');
    if (disciplinas.length === 0) {
      await db.exec(`
        INSERT INTO disciplinas (nome, codigo, carga_horaria) VALUES 
        ('Matemática', 'MAT101', 60),
        ('Português', 'POR101', 60),
        ('Ciências', 'CIE101', 60),
        ('História', 'HIS101', 60),
        ('Inglês', 'ING101', 60),
        ('Educação Física', 'EDF101', 30);
      `);
      console.log('✅ Disciplinas padrão criadas');
    }

    // Criar turmas padrão
    const turmas = await db.all('SELECT * FROM turmas');
    if (turmas.length === 0) {
      await db.exec(`
        INSERT INTO turmas (nome, ano, turno) VALUES 
        ('9º A', 9, 'manha'),
        ('9º B', 9, 'tarde'),
        ('8º A', 8, 'manha'),
        ('8º B', 8, 'tarde'),
        ('7º A', 7, 'manha');
      `);
      console.log('✅ Turmas padrão criadas');
    }

  } catch (error) {
    console.error('❌ Erro ao inicializar banco:', error.message);
  }
}

// ===== MIDDLEWARE DE AUTENTICAÇÃO =====
const autenticar = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ erro: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
};

// ===== ROTAS DE AUTENTICAÇÃO =====

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    console.log(`📩 Login request: ${email}`);

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    const usuario = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (!usuario) {
      console.log(`❌ Usuário não encontrado: ${email}`);
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      console.log(`❌ Senha inválida para: ${email}`);
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    delete usuario.senha;

    console.log(`✅ Login bem-sucedido: ${email}`);
    res.json({
      mensagem: 'Login realizado com sucesso',
      usuario,
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro ao realizar login' });
  }
});

app.post('/api/auth/registrar', async (req, res) => {
  try {
    const { nome, email, senha, tipo } = req.body;

    if (!nome || !email || !senha || !tipo) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    const usuarioExistente = await db.get('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const result = await db.run(
      `INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
      [nome, email, senhaHash, tipo]
    );

    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [result.lastID]);
    delete usuario.senha;

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      mensagem: 'Usuário criado com sucesso',
      usuario,
      token
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

app.get('/api/auth/perfil', autenticar, async (req, res) => {
  try {
    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [req.usuario.id]);

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    delete usuario.senha;
    res.json(usuario);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    res.status(500).json({ erro: 'Erro ao buscar perfil' });
  }
});

// ===== ROTAS DE USUÁRIOS (ADMIN) =====

app.get('/api/usuarios', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    const usuarios = await db.all('SELECT id, nome, email, tipo, telefone, data_nascimento, criado_em FROM usuarios ORDER BY tipo, nome');
    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ erro: 'Erro ao listar usuários' });
  }
});

app.get('/api/usuarios/tipo/:tipo', autenticar, async (req, res) => {
  try {
    const { tipo } = req.params;
    const usuarios = await db.all('SELECT id, nome, email, tipo, telefone FROM usuarios WHERE tipo = ? ORDER BY nome', [tipo]);
    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ erro: 'Erro ao listar usuários' });
  }
});

app.post('/api/usuarios', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { nome, email, senha, tipo, telefone, data_nascimento } = req.body;

    if (!nome || !email || !senha || !tipo) {
      return res.status(400).json({ erro: 'Nome, email, senha e tipo são obrigatórios' });
    }

    if (!['professor', 'aluno', 'pai', 'admin'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo de usuário inválido' });
    }

    const existe = await db.get('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existe) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const result = await db.run(
      `INSERT INTO usuarios (nome, email, senha, tipo, telefone, data_nascimento) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nome, email, senhaHash, tipo, telefone || null, data_nascimento || null]
    );

    const usuario = await db.get('SELECT id, nome, email, tipo, telefone FROM usuarios WHERE id = ?', [result.lastID]);

    res.status(201).json({
      mensagem: 'Usuário criado com sucesso',
      usuario
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

app.put('/api/usuarios/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { id } = req.params;
    const { nome, email, telefone, data_nascimento, senha } = req.body;

    const usuario = await db.get('SELECT * FROM usuarios WHERE id = ?', [id]);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    let senhaHash = usuario.senha;
    if (senha) {
      senhaHash = await bcrypt.hash(senha, 10);
    }

    await db.run(
      `UPDATE usuarios SET nome = ?, email = ?, telefone = ?, data_nascimento = ?, senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [nome || usuario.nome, email || usuario.email, telefone || usuario.telefone, data_nascimento || usuario.data_nascimento, senhaHash, id]
    );

    const usuarioAtualizado = await db.get('SELECT id, nome, email, tipo, telefone FROM usuarios WHERE id = ?', [id]);
    res.json({ mensagem: 'Usuário atualizado', usuario: usuarioAtualizado });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

app.delete('/api/usuarios/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    res.status(500).json({ erro: 'Erro ao remover usuário' });
  }
});

// ===== ROTAS DE TURMAS =====

app.get('/api/turmas', autenticar, async (req, res) => {
  try {
    const turmas = await db.all('SELECT * FROM turmas ORDER BY ano, nome');
    res.json(turmas);
  } catch (error) {
    console.error('Erro ao listar turmas:', error);
    res.status(500).json({ erro: 'Erro ao listar turmas' });
  }
});

app.post('/api/turmas', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { nome, ano, turno } = req.body;

    if (!nome || !ano || !turno) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    const result = await db.run(
      `INSERT INTO turmas (nome, ano, turno) VALUES (?, ?, ?)`,
      [nome, ano, turno]
    );

    res.status(201).json({ mensagem: 'Turma criada com sucesso', id: result.lastID });
  } catch (error) {
    console.error('Erro ao criar turma:', error);
    res.status(500).json({ erro: 'Erro ao criar turma' });
  }
});

app.delete('/api/turmas/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await db.run('DELETE FROM turmas WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Turma removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover turma:', error);
    res.status(500).json({ erro: 'Erro ao remover turma' });
  }
});

app.get('/api/turmas/:id/alunos', autenticar, async (req, res) => {
  try {
    const { id } = req.params;

    const alunos = await db.all(`
      SELECT 
        u.id,
        u.nome,
        u.email,
        u.telefone,
        m.id as matricula_id,
        m.data_matricula,
        m.status
      FROM matriculas m
      JOIN usuarios u ON m.aluno_id = u.id
      WHERE m.turma_id = ? AND u.tipo = 'aluno'
      ORDER BY u.nome
    `, [id]);

    res.json(alunos);
  } catch (error) {
    console.error('Erro ao listar alunos da turma:', error);
    res.status(500).json({ erro: 'Erro ao listar alunos' });
  }
});

app.get('/api/turmas-completas', autenticar, async (req, res) => {
  try {
    const turmas = await db.all(`
      SELECT 
        t.id,
        t.nome,
        t.ano,
        t.turno,
        COUNT(DISTINCT m.aluno_id) as total_alunos,
        COUNT(DISTINCT pdt.disciplina_id) as total_disciplinas
      FROM turmas t
      LEFT JOIN matriculas m ON t.id = m.turma_id
      LEFT JOIN professor_disciplina_turma pdt ON t.id = pdt.turma_id
      GROUP BY t.id
      ORDER BY t.ano, t.nome
    `);

    for (const turma of turmas) {
      const disciplinas = await db.all(`
        SELECT 
          d.id,
          d.nome as disciplina,
          u.id as professor_id,
          u.nome as professor,
          pdt.carga_horaria,
          pdt.id as alocacao_id
        FROM professor_disciplina_turma pdt
        JOIN disciplinas d ON pdt.disciplina_id = d.id
        JOIN usuarios u ON pdt.professor_id = u.id
        WHERE pdt.turma_id = ?
      `, [turma.id]);

      turma.disciplinas = disciplinas;
    }

    res.json(turmas);
  } catch (error) {
    console.error('Erro ao listar turmas completas:', error);
    res.status(500).json({ erro: 'Erro ao listar turmas' });
  }
});

// ===== ROTAS DE MATRÍCULAS =====

app.post('/api/matriculas', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { aluno_id, turma_id, ano_letivo } = req.body;

    if (!aluno_id || !turma_id || !ano_letivo) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    const existe = await db.get(
      'SELECT * FROM matriculas WHERE aluno_id = ? AND turma_id = ? AND ano_letivo = ? AND status = "ativa"',
      [aluno_id, turma_id, ano_letivo]
    );

    if (existe) {
      return res.status(400).json({ erro: 'Aluno já está matriculado nesta turma' });
    }

    await db.run(
      `INSERT INTO matriculas (aluno_id, turma_id, ano_letivo, status) 
       VALUES (?, ?, ?, 'ativa')`,
      [aluno_id, turma_id, ano_letivo]
    );

    res.status(201).json({ mensagem: 'Aluno matriculado com sucesso' });
  } catch (error) {
    console.error('Erro ao matricular aluno:', error);
    res.status(500).json({ erro: 'Erro ao matricular aluno' });
  }
});

app.delete('/api/matriculas/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await db.run('DELETE FROM matriculas WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Aluno desmatriculado com sucesso' });
  } catch (error) {
    console.error('Erro ao remover matrícula:', error);
    res.status(500).json({ erro: 'Erro ao remover matrícula' });
  }
});

app.get('/api/alunos/disponiveis', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const alunos = await db.all(`
      SELECT u.id, u.nome, u.email
      FROM usuarios u
      WHERE u.tipo = 'aluno' 
      AND NOT EXISTS (
        SELECT 1 FROM matriculas m 
        WHERE m.aluno_id = u.id AND m.status = 'ativa'
      )
      ORDER BY u.nome
    `);

    res.json(alunos);
  } catch (error) {
    console.error('Erro ao listar alunos disponíveis:', error);
    res.status(500).json({ erro: 'Erro ao listar alunos' });
  }
});

app.get('/api/alunos/todos', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const alunos = await db.all(`
      SELECT u.id, u.nome, u.email, u.telefone,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM matriculas m 
            WHERE m.aluno_id = u.id AND m.status = 'ativa'
          ) THEN 'matriculado'
          ELSE 'disponivel'
        END as status_matricula
      FROM usuarios u
      WHERE u.tipo = 'aluno'
      ORDER BY u.nome
    `);

    res.json(alunos);
  } catch (error) {
    console.error('Erro ao listar alunos:', error);
    res.status(500).json({ erro: 'Erro ao listar alunos' });
  }
});

// ===== ROTAS DE DISCIPLINAS =====

app.get('/api/disciplinas', autenticar, async (req, res) => {
  try {
    const disciplinas = await db.all('SELECT id, nome, codigo, carga_horaria FROM disciplinas ORDER BY nome');
    res.json(disciplinas);
  } catch (error) {
    console.error('Erro ao listar disciplinas:', error);
    res.status(500).json({ erro: 'Erro ao listar disciplinas' });
  }
});

// ===== ROTAS DE ALOCAÇÕES =====

app.get('/api/alocacoes', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const alocacoes = await db.all(`
      SELECT 
        pdt.id,
        pdt.ano_letivo,
        pdt.carga_horaria,
        p.nome as professor_nome,
        p.id as professor_id,
        d.nome as disciplina_nome,
        d.id as disciplina_id,
        t.nome as turma_nome,
        t.id as turma_id
      FROM professor_disciplina_turma pdt
      JOIN usuarios p ON pdt.professor_id = p.id
      JOIN disciplinas d ON pdt.disciplina_id = d.id
      JOIN turmas t ON pdt.turma_id = t.id
      ORDER BY t.nome, d.nome
    `);

    res.json(alocacoes);
  } catch (error) {
    console.error('Erro ao listar alocações:', error);
    res.status(500).json({ erro: 'Erro ao listar alocações' });
  }
});

app.post('/api/alocacoes', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { professor_id, disciplina_id, turma_id, ano_letivo, carga_horaria } = req.body;

    const existe = await db.get(
      'SELECT * FROM professor_disciplina_turma WHERE professor_id = ? AND disciplina_id = ? AND turma_id = ? AND ano_letivo = ?',
      [professor_id, disciplina_id, turma_id, ano_letivo]
    );

    if (existe) {
      return res.status(400).json({ erro: 'Esta alocação já existe' });
    }

    await db.run(
      `INSERT INTO professor_disciplina_turma (professor_id, disciplina_id, turma_id, ano_letivo, carga_horaria)
       VALUES (?, ?, ?, ?, ?)`,
      [professor_id, disciplina_id, turma_id, ano_letivo, carga_horaria || 2]
    );

    res.status(201).json({ mensagem: 'Alocação criada com sucesso' });
  } catch (error) {
    console.error('Erro ao criar alocação:', error);
    res.status(500).json({ erro: 'Erro ao criar alocação' });
  }
});

app.delete('/api/alocacoes/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await db.run('DELETE FROM professor_disciplina_turma WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Alocação removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover alocação:', error);
    res.status(500).json({ erro: 'Erro ao remover alocação' });
  }
});

// ===== ROTAS DE PAIS-ALUNOS =====

app.post('/api/pais-alunos', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { pai_id, aluno_id, parentesco } = req.body;

    if (!pai_id || !aluno_id) {
      return res.status(400).json({ erro: 'Pai e aluno são obrigatórios' });
    }

    const existe = await db.get(
      'SELECT * FROM pais_alunos WHERE pai_id = ? AND aluno_id = ?',
      [pai_id, aluno_id]
    );

    if (existe) {
      return res.status(400).json({ erro: 'Esta associação já existe' });
    }

    await db.run(
      `INSERT INTO pais_alunos (pai_id, aluno_id, parentesco) VALUES (?, ?, ?)`,
      [pai_id, aluno_id, parentesco || 'pai']
    );

    res.status(201).json({ mensagem: 'Associação criada com sucesso' });
  } catch (error) {
    console.error('Erro ao associar pai-aluno:', error);
    res.status(500).json({ erro: 'Erro ao associar' });
  }
});

app.get('/api/pais-alunos/:paiId', autenticar, async (req, res) => {
  try {
    const { paiId } = req.params;

    const alunos = await db.all(`
      SELECT 
        a.id, a.nome, a.email, a.telefone, a.data_nascimento,
        pa.parentesco
      FROM pais_alunos pa
      JOIN usuarios a ON pa.aluno_id = a.id
      WHERE pa.pai_id = ?
    `, [paiId]);

    for (const aluno of alunos) {
      const turma = await db.get(`
        SELECT t.id, t.nome, t.ano, t.turno
        FROM matriculas m
        JOIN turmas t ON m.turma_id = t.id
        WHERE m.aluno_id = ? AND m.status = 'ativa'
        LIMIT 1
      `, [aluno.id]);

      aluno.turma = turma || null;
    }

    res.json(alunos);
  } catch (error) {
    console.error('Erro ao buscar alunos do pai:', error);
    res.status(500).json({ erro: 'Erro ao buscar alunos' });
  }
});

app.get('/api/pais-alunos', autenticar, async (req, res) => {
  try {
    const associacoes = await db.all(`
      SELECT 
        pa.id,
        p.id as pai_id,
        p.nome as pai_nome,
        p.email as pai_email,
        a.id as aluno_id,
        a.nome as aluno_nome,
        a.email as aluno_email,
        pa.parentesco
      FROM pais_alunos pa
      JOIN usuarios p ON pa.pai_id = p.id
      JOIN usuarios a ON pa.aluno_id = a.id
      ORDER BY p.nome, a.nome
    `);

    res.json(associacoes);
  } catch (error) {
    console.error('Erro ao listar associações:', error);
    res.status(500).json({ erro: 'Erro ao listar associações' });
  }
});

app.delete('/api/pais-alunos/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await db.run('DELETE FROM pais_alunos WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Associação removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover associação:', error);
    res.status(500).json({ erro: 'Erro ao remover associação' });
  }
});

// ===== ROTAS DO PROFESSOR =====

app.get('/api/professor/turmas', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const turmas = await db.all(`
      SELECT DISTINCT 
        t.id, t.nome, t.ano, t.turno
      FROM professor_disciplina_turma pdt
      JOIN turmas t ON pdt.turma_id = t.id
      WHERE pdt.professor_id = ?
      ORDER BY t.ano, t.nome
    `, [req.usuario.id]);

    for (const turma of turmas) {
      const disciplinas = await db.all(`
        SELECT d.id, d.nome
        FROM professor_disciplina_turma pdt
        JOIN disciplinas d ON pdt.disciplina_id = d.id
        WHERE pdt.professor_id = ? AND pdt.turma_id = ?
      `, [req.usuario.id, turma.id]);

      turma.disciplinas = disciplinas;

      const count = await db.get(`
        SELECT COUNT(*) as total FROM matriculas 
        WHERE turma_id = ? AND status = 'ativa'
      `, [turma.id]);

      turma.total_alunos = count.total;
    }

    res.json(turmas);
  } catch (error) {
    console.error('Erro ao buscar turmas do professor:', error);
    res.status(500).json({ erro: 'Erro ao buscar turmas' });
  }
});

app.get('/api/professor/turma/:turmaId/alunos', autenticar, async (req, res) => {
  try {
    const { turmaId } = req.params;

    const alunos = await db.all(`
      SELECT 
        u.id, u.nome, u.email, u.telefone
      FROM matriculas m
      JOIN usuarios u ON m.aluno_id = u.id
      WHERE m.turma_id = ? AND m.status = 'ativa' AND u.tipo = 'aluno'
      ORDER BY u.nome
    `, [turmaId]);

    res.json(alunos);
  } catch (error) {
    console.error('Erro ao buscar alunos da turma:', error);
    res.status(500).json({ erro: 'Erro ao buscar alunos' });
  }
});

// ===== ROTAS DO PROFESSOR (COM FILTRO POR DISCIPLINA) =====

async function professorLecionaDisciplina(professorId, disciplinaId, turmaId) {
  const alocacao = await db.get(`
    SELECT * FROM professor_disciplina_turma 
    WHERE professor_id = ? AND disciplina_id = ? AND turma_id = ?
  `, [professorId, disciplinaId, turmaId]);
  return !!alocacao;
}

app.get('/api/professor/presencas/:turmaId/:disciplinaId', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turmaId, disciplinaId } = req.params;

    if (req.usuario.tipo === 'professor') {
      const leciona = await professorLecionaDisciplina(req.usuario.id, disciplinaId, turmaId);
      if (!leciona) {
        return res.status(403).json({ erro: 'Não leciona esta disciplina nesta turma' });
      }
    }

    const presencas = await db.all(`
      SELECT 
        p.id, p.data, p.presente, p.justificativa,
        u.nome as aluno_nome, u.id as aluno_id,
        d.nome as disciplina_nome,
        t.nome as turma_nome
      FROM presencas p
      JOIN usuarios u ON p.aluno_id = u.id
      JOIN disciplinas d ON p.disciplina_id = d.id
      JOIN turmas t ON p.turma_id = t.id
      WHERE p.turma_id = ? AND p.disciplina_id = ?
      ORDER BY p.data DESC, u.nome
    `, [turmaId, disciplinaId]);

    res.json(presencas);
  } catch (error) {
    console.error('Erro ao buscar presenças:', error);
    res.status(500).json({ erro: 'Erro ao buscar presenças' });
  }
});

app.get('/api/professor/presencas/:turmaId/:disciplinaId/estatisticas', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turmaId, disciplinaId } = req.params;

    if (req.usuario.tipo === 'professor') {
      const leciona = await professorLecionaDisciplina(req.usuario.id, disciplinaId, turmaId);
      if (!leciona) {
        return res.status(403).json({ erro: 'Não leciona esta disciplina' });
      }
    }

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN presente = 1 THEN 1 ELSE 0 END) as presencas,
        SUM(CASE WHEN presente = 0 THEN 1 ELSE 0 END) as faltas
      FROM presencas
      WHERE turma_id = ? AND disciplina_id = ?
    `, [turmaId, disciplinaId]);

    const porAluno = await db.all(`
      SELECT 
        u.id as aluno_id,
        u.nome as aluno_nome,
        COUNT(*) as total,
        SUM(CASE WHEN p.presente = 1 THEN 1 ELSE 0 END) as presencas,
        SUM(CASE WHEN p.presente = 0 THEN 1 ELSE 0 END) as faltas
      FROM presencas p
      JOIN usuarios u ON p.aluno_id = u.id
      WHERE p.turma_id = ? AND p.disciplina_id = ?
      GROUP BY u.id, u.nome
      ORDER BY u.nome
    `, [turmaId, disciplinaId]);

    res.json({
      total: stats.total || 0,
      presencas: stats.presencas || 0,
      faltas: stats.faltas || 0,
      percentual: stats.total > 0 ? Math.round((stats.presencas / stats.total) * 100) : 0,
      por_aluno: porAluno
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

app.get('/api/professor/notas/:turmaId/:disciplinaId', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turmaId, disciplinaId } = req.params;
    const { trimestre } = req.query;

    if (req.usuario.tipo === 'professor') {
      const leciona = await professorLecionaDisciplina(req.usuario.id, disciplinaId, turmaId);
      if (!leciona) {
        return res.status(403).json({ erro: 'Não leciona esta disciplina' });
      }
    }

    const alunos = await db.all(`
      SELECT u.id, u.nome, u.email
      FROM usuarios u
      JOIN matriculas m ON u.id = m.aluno_id
      WHERE m.turma_id = ? AND m.status = 'ativa' AND u.tipo = 'aluno'
      ORDER BY u.nome
    `, [turmaId]);

    let sql = `
      SELECT aluno_id, trimestre, tipo_avaliacao, nota
      FROM notas
      WHERE turma_id = ? AND disciplina_id = ?
    `;
    const params = [turmaId, disciplinaId];

    if (trimestre) {
      sql += ' AND trimestre = ?';
      params.push(trimestre);
    }

    const notas = await db.all(sql, params);

    const resultado = alunos.map(aluno => {
      const notasAluno = {};

      notas.filter(n => n.aluno_id === aluno.id).forEach(n => {
        const key = `T${n.trimestre}_${n.tipo_avaliacao}`;
        notasAluno[key] = n.nota;
      });

      let media = null;
      if (trimestre) {
        const acs1 = notasAluno[`T${trimestre}_ACS1`];
        const acs2 = notasAluno[`T${trimestre}_ACS2`];
        const at = notasAluno[`T${trimestre}_AT`];

        if (acs1 !== undefined && acs2 !== undefined && at !== undefined) {
          media = Math.round(((acs1 * 0.3) + (acs2 * 0.3) + (at * 0.4)) * 100) / 100;
        }
      }

      return {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        aluno_email: aluno.email,
        notas: notasAluno,
        media
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    res.status(500).json({ erro: 'Erro ao buscar notas' });
  }
});

app.get('/api/professor/tpc', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turma_id, disciplina_id } = req.query;

    let sql = `
      SELECT 
        t.id, t.titulo, t.descricao, t.data_entrega, t.criado_em,
        d.id as disciplina_id, d.nome as disciplina_nome,
        tu.id as turma_id, tu.nome as turma_nome,
        p.nome as professor_nome
      FROM tpc t
      JOIN disciplinas d ON t.disciplina_id = d.id
      JOIN turmas tu ON t.turma_id = tu.id
      JOIN usuarios p ON t.professor_id = p.id
      WHERE t.professor_id = ?
    `;
    const params = [req.usuario.id];

    if (turma_id) {
      sql += ' AND t.turma_id = ?';
      params.push(turma_id);
    }

    if (disciplina_id) {
      sql += ' AND t.disciplina_id = ?';
      params.push(disciplina_id);
    }

    sql += ' ORDER BY t.data_entrega DESC';

    const tpcs = await db.all(sql, params);
    res.json(tpcs);
  } catch (error) {
    console.error('Erro ao buscar TPCs:', error);
    res.status(500).json({ erro: 'Erro ao buscar TPCs' });
  }
});

app.get('/api/professor/tpc/:tpcId/entregas', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { tpcId } = req.params;

    const tpc = await db.get('SELECT * FROM tpc WHERE id = ?', [tpcId]);
    if (!tpc) {
      return res.status(404).json({ erro: 'TPC não encontrado' });
    }

    if (req.usuario.tipo === 'professor' && tpc.professor_id !== req.usuario.id) {
      return res.status(403).json({ erro: 'Este TPC não é seu' });
    }

    const alunos = await db.all(`
      SELECT u.id, u.nome, u.email
      FROM usuarios u
      JOIN matriculas m ON u.id = m.aluno_id
      WHERE m.turma_id = ? AND m.status = 'ativa' AND u.tipo = 'aluno'
      ORDER BY u.nome
    `, [tpc.turma_id]);

    const entregas = await db.all(`
      SELECT * FROM tpc_entregas WHERE tpc_id = ?
    `, [tpcId]);

    const resultado = alunos.map(aluno => {
      const entrega = entregas.find(e => e.aluno_id === aluno.id);

      return {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        aluno_email: aluno.email,
        entregue: entrega ? entrega.entregue === 1 : false,
        marcado_professor: entrega ? entrega.marcado_professor === 1 : false,
        data_entrega: entrega ? entrega.data_entrega : null,
        nota: entrega ? entrega.nota : null,
        comentario: entrega ? entrega.comentario : null,
        entrega_id: entrega ? entrega.id : null
      };
    });

    res.json({
      tpc: {
        id: tpc.id,
        titulo: tpc.titulo,
        descricao: tpc.descricao,
        data_entrega: tpc.data_entrega,
        disciplina_id: tpc.disciplina_id,
        turma_id: tpc.turma_id
      },
      entregas: resultado,
      stats: {
        total: alunos.length,
        entregues: resultado.filter(r => r.entregue).length,
        pendentes: resultado.filter(r => !r.entregue).length
      }
    });
  } catch (error) {
    console.error('Erro ao buscar entregas:', error);
    res.status(500).json({ erro: 'Erro ao buscar entregas' });
  }
});

// ===== ROTAS DE PRESENÇAS =====

app.post('/api/presencas', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { presencas, turma_id, disciplina_id, data } = req.body;

    if (!presencas || !Array.isArray(presencas) || !turma_id || !disciplina_id || !data) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }

    for (const item of presencas) {
      const { aluno_id, presente } = item;

      const existe = await db.get(
        'SELECT id FROM presencas WHERE aluno_id = ? AND turma_id = ? AND disciplina_id = ? AND data = ?',
        [aluno_id, turma_id, disciplina_id, data]
      );

      if (existe) {
        await db.run(
          'UPDATE presencas SET presente = ? WHERE id = ?',
          [presente ? 1 : 0, existe.id]
        );
      } else {
        await db.run(
          `INSERT INTO presencas (aluno_id, turma_id, disciplina_id, data, presente) 
           VALUES (?, ?, ?, ?, ?)`,
          [aluno_id, turma_id, disciplina_id, data, presente ? 1 : 0]
        );
      }
    }

    res.json({ mensagem: 'Presenças salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar presenças:', error);
    res.status(500).json({ erro: 'Erro ao salvar presenças' });
  }
});

app.get('/api/presencas/aluno/:alunoId', autenticar, async (req, res) => {
  try {
    const { alunoId } = req.params;
    const { mes, ano } = req.query;

    let sql = `
      SELECT 
        p.id, p.data, p.presente, p.justificativa,
        d.nome as disciplina_nome,
        t.nome as turma_nome
      FROM presencas p
      LEFT JOIN disciplinas d ON p.disciplina_id = d.id
      LEFT JOIN turmas t ON p.turma_id = t.id
      WHERE p.aluno_id = ?
    `;
    const params = [alunoId];

    if (mes && ano) {
      sql += ` AND strftime('%m', p.data) = ? AND strftime('%Y', p.data) = ?`;
      params.push(mes.padStart(2, '0'), ano);
    }

    sql += ' ORDER BY p.data DESC LIMIT 50';

    const presencas = await db.all(sql, params);
    res.json(presencas);
  } catch (error) {
    console.error('Erro ao buscar presenças:', error);
    res.status(500).json({ erro: 'Erro ao buscar presenças' });
  }
});

app.get('/api/presencas/aluno/:alunoId/estatisticas', autenticar, async (req, res) => {
  try {
    const { alunoId } = req.params;

    const stats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN presente = 1 THEN 1 ELSE 0 END) as presencas,
        SUM(CASE WHEN presente = 0 THEN 1 ELSE 0 END) as faltas
      FROM presencas
      WHERE aluno_id = ?
    `, [alunoId]);

    const percentual = stats.total > 0
      ? Math.round((stats.presencas / stats.total) * 100)
      : 100;

    res.json({
      total: stats.total,
      presencas: stats.presencas || 0,
      faltas: stats.faltas || 0,
      percentual
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

app.get('/api/presencas/aluno/:alunoId/semana', autenticar, async (req, res) => {
  try {
    const { alunoId } = req.params;

    const presencas = await db.all(`
      SELECT data, presente
      FROM presencas
      WHERE aluno_id = ?
      ORDER BY data DESC
      LIMIT 7
    `, [alunoId]);

    res.json(presencas);
  } catch (error) {
    console.error('Erro ao buscar presenças semanais:', error);
    res.status(500).json({ erro: 'Erro ao buscar presenças' });
  }
});

// ===== ROTAS DE NOTAS =====

app.get('/api/notas/aluno/:alunoId', autenticar, async (req, res) => {
  try {
    const { alunoId } = req.params;
    const { trimestre } = req.query;

    let sql = `
      SELECT 
        n.id, n.trimestre, n.tipo_avaliacao, n.nota,
        d.id as disciplina_id, d.nome as disciplina_nome,
        t.id as turma_id, t.nome as turma_nome
      FROM notas n
      JOIN disciplinas d ON n.disciplina_id = d.id
      JOIN turmas t ON n.turma_id = t.id
      WHERE n.aluno_id = ?
    `;
    const params = [alunoId];

    if (trimestre) {
      sql += ' AND n.trimestre = ?';
      params.push(trimestre);
    }

    sql += ' ORDER BY n.trimestre, d.nome, n.tipo_avaliacao';

    const notas = await db.all(sql, params);

    const resultado = {};

    notas.forEach(nota => {
      const key = `${nota.disciplina_id}_${nota.trimestre}`;

      if (!resultado[key]) {
        resultado[key] = {
          disciplina_id: nota.disciplina_id,
          disciplina_nome: nota.disciplina_nome,
          turma_id: nota.turma_id,
          turma_nome: nota.turma_nome,
          trimestre: nota.trimestre,
          ACS1: null,
          ACS2: null,
          AT: null,
          media: null
        };
      }

      resultado[key][nota.tipo_avaliacao] = nota.nota;
    });

    Object.values(resultado).forEach(item => {
      if (item.ACS1 !== null && item.ACS2 !== null && item.AT !== null) {
        item.media = Math.round(
          ((item.ACS1 * 0.3) + (item.ACS2 * 0.3) + (item.AT * 0.4)) * 100
        ) / 100;
      }
    });

    res.json(Object.values(resultado));
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    res.status(500).json({ erro: 'Erro ao buscar notas' });
  }
});

app.get('/api/notas/turma/:turmaId', autenticar, async (req, res) => {
  try {
    const { turmaId } = req.params;
    const { disciplina_id, trimestre } = req.query;

    if (!disciplina_id || !trimestre) {
      return res.status(400).json({ erro: 'Disciplina e trimestre são obrigatórios' });
    }

    const alunos = await db.all(`
      SELECT u.id, u.nome, u.email
      FROM usuarios u
      JOIN matriculas m ON u.id = m.aluno_id
      WHERE m.turma_id = ? AND m.status = 'ativa' AND u.tipo = 'aluno'
      ORDER BY u.nome
    `, [turmaId]);

    const notas = await db.all(`
      SELECT aluno_id, tipo_avaliacao, nota
      FROM notas
      WHERE turma_id = ? AND disciplina_id = ? AND trimestre = ?
    `, [turmaId, disciplina_id, trimestre]);

    const resultado = alunos.map(aluno => {
      const notasAluno = { ACS1: null, ACS2: null, AT: null };

      notas.filter(n => n.aluno_id === aluno.id).forEach(n => {
        notasAluno[n.tipo_avaliacao] = n.nota;
      });

      let media = null;
      if (notasAluno.ACS1 !== null && notasAluno.ACS2 !== null && notasAluno.AT !== null) {
        media = Math.round(
          ((notasAluno.ACS1 * 0.3) + (notasAluno.ACS2 * 0.3) + (notasAluno.AT * 0.4)) * 100
        ) / 100;
      }

      return {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        ...notasAluno,
        media
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar notas da turma:', error);
    res.status(500).json({ erro: 'Erro ao buscar notas' });
  }
});

app.post('/api/notas/lote', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { notas, disciplina_id, turma_id, trimestre } = req.body;

    if (!notas || !Array.isArray(notas) || !disciplina_id || !turma_id || !trimestre) {
      return res.status(400).json({ erro: 'Dados inválidos' });
    }

    for (const item of notas) {
      const { aluno_id, ACS1, ACS2, AT } = item;

      if (ACS1 !== null && ACS1 !== undefined && ACS1 !== '') {
        await salvarNota(aluno_id, disciplina_id, turma_id, trimestre, 'ACS1', parseFloat(ACS1));
      }
      if (ACS2 !== null && ACS2 !== undefined && ACS2 !== '') {
        await salvarNota(aluno_id, disciplina_id, turma_id, trimestre, 'ACS2', parseFloat(ACS2));
      }
      if (AT !== null && AT !== undefined && AT !== '') {
        await salvarNota(aluno_id, disciplina_id, turma_id, trimestre, 'AT', parseFloat(AT));
      }
    }

    res.json({ mensagem: 'Notas salvas com sucesso' });
  } catch (error) {
    console.error('Erro ao salvar notas:', error);
    res.status(500).json({ erro: 'Erro ao salvar notas' });
  }
});

async function salvarNota(aluno_id, disciplina_id, turma_id, trimestre, tipo_avaliacao, nota) {
  const existe = await db.get(
    `SELECT id FROM notas WHERE aluno_id = ? AND disciplina_id = ? AND turma_id = ? AND trimestre = ? AND tipo_avaliacao = ?`,
    [aluno_id, disciplina_id, turma_id, trimestre, tipo_avaliacao]
  );

  if (existe) {
    await db.run(
      `UPDATE notas SET nota = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
      [nota, existe.id]
    );
  } else {
    await db.run(
      `INSERT INTO notas (aluno_id, disciplina_id, turma_id, trimestre, tipo_avaliacao, nota)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [aluno_id, disciplina_id, turma_id, trimestre, tipo_avaliacao, nota]
    );
  }
}

app.get('/api/notas/media/:alunoId', autenticar, async (req, res) => {
  try {
    const { alunoId } = req.params;
    const { trimestre } = req.query;

    let sql = `
      SELECT 
        n.disciplina_id, d.nome as disciplina_nome,
        n.trimestre, n.tipo_avaliacao, n.nota
      FROM notas n
      JOIN disciplinas d ON n.disciplina_id = d.id
      WHERE n.aluno_id = ?
    `;
    const params = [alunoId];

    if (trimestre) {
      sql += ' AND n.trimestre = ?';
      params.push(trimestre);
    }

    const notas = await db.all(sql, params);

    const medias = {};

    notas.forEach(nota => {
      const key = `${nota.disciplina_id}_${nota.trimestre}`;

      if (!medias[key]) {
        medias[key] = {
          disciplina_id: nota.disciplina_id,
          disciplina_nome: nota.disciplina_nome,
          trimestre: nota.trimestre,
          ACS1: null, ACS2: null, AT: null, media: null
        };
      }

      medias[key][nota.tipo_avaliacao] = nota.nota;
    });

    Object.values(medias).forEach(item => {
      if (item.ACS1 !== null && item.ACS2 !== null && item.AT !== null) {
        item.media = Math.round(
          ((item.ACS1 * 0.3) + (item.ACS2 * 0.3) + (item.AT * 0.4)) * 100
        ) / 100;
      }
    });

    const mediasValidas = Object.values(medias).filter(m => m.media !== null);
    const mediaGeral = mediasValidas.length > 0
      ? Math.round((mediasValidas.reduce((acc, m) => acc + m.media, 0) / mediasValidas.length) * 100) / 100
      : null;

    res.json({
      medias: Object.values(medias),
      media_geral: mediaGeral
    });
  } catch (error) {
    console.error('Erro ao calcular média:', error);
    res.status(500).json({ erro: 'Erro ao calcular média' });
  }
});

// ===== ROTAS DE TPC =====

app.get('/api/tpc/turma/:turmaId', autenticar, async (req, res) => {
  try {
    const { turmaId } = req.params;

    const tpc = await db.all(`
      SELECT 
        t.id, t.titulo, t.descricao, t.data_entrega, t.criado_em,
        d.nome as disciplina_nome,
        p.nome as professor_nome
      FROM tpc t
      JOIN disciplinas d ON t.disciplina_id = d.id
      JOIN usuarios p ON t.professor_id = p.id
      WHERE t.turma_id = ?
      ORDER BY t.data_entrega DESC
    `, [turmaId]);

    res.json(tpc);
  } catch (error) {
    console.error('Erro ao buscar TPCs:', error);
    res.status(500).json({ erro: 'Erro ao buscar TPCs' });
  }
});

app.get('/api/tpc/aluno/:alunoId', autenticar, async (req, res) => {
  try {
    const { alunoId } = req.params;

    const tpc = await db.all(`
      SELECT 
        t.id, t.titulo, t.descricao, t.data_entrega, t.criado_em,
        d.nome as disciplina_nome,
        p.nome as professor_nome
      FROM tpc t
      JOIN disciplinas d ON t.disciplina_id = d.id
      JOIN usuarios p ON t.professor_id = p.id
      JOIN matriculas m ON t.turma_id = m.turma_id
      WHERE m.aluno_id = ? AND m.status = 'ativa'
      ORDER BY t.data_entrega DESC
    `, [alunoId]);

    res.json(tpc);
  } catch (error) {
    console.error('Erro ao buscar TPCs do aluno:', error);
    res.status(500).json({ erro: 'Erro ao buscar TPCs' });
  }
});

app.post('/api/tpc', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { titulo, descricao, disciplina_id, turma_id, data_entrega } = req.body;

    if (!titulo || !disciplina_id || !turma_id || !data_entrega) {
      return res.status(400).json({ erro: 'Campos obrigatórios em falta' });
    }

    const result = await db.run(
      `INSERT INTO tpc (titulo, descricao, disciplina_id, turma_id, professor_id, data_entrega)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [titulo, descricao || '', disciplina_id, turma_id, req.usuario.id, data_entrega]
    );

    res.status(201).json({ mensagem: 'TPC criado com sucesso', id: result.lastID });
  } catch (error) {
    console.error('Erro ao criar TPC:', error);
    res.status(500).json({ erro: 'Erro ao criar TPC' });
  }
});

app.delete('/api/tpc/:id', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    await db.run('DELETE FROM tpc WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'TPC removido com sucesso' });
  } catch (error) {
    console.error('Erro ao remover TPC:', error);
    res.status(500).json({ erro: 'Erro ao remover TPC' });
  }
});

// ===== ROTAS DE MENSAGENS =====

app.post('/api/mensagens', autenticar, async (req, res) => {
  try {
    const { destinatario_id, turma_id, assunto, conteudo } = req.body;

    if (!assunto || !conteudo) {
      return res.status(400).json({ erro: 'Assunto e conteúdo são obrigatórios' });
    }

    const result = await db.run(
      `INSERT INTO mensagens (remetente_id, destinatario_id, turma_id, assunto, conteudo)
       VALUES (?, ?, ?, ?, ?)`,
      [req.usuario.id, destinatario_id || null, turma_id || null, assunto, conteudo]
    );

    res.status(201).json({ mensagem: 'Mensagem enviada com sucesso', id: result.lastID });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ erro: 'Erro ao enviar mensagem' });
  }
});

app.get('/api/mensagens/recebidas', autenticar, async (req, res) => {
  try {
    const meuId = req.usuario.id;
    const meuTipo = req.usuario.tipo;

    let turmaId = null;
    if (meuTipo === 'aluno') {
      const matricula = await db.get(`
        SELECT turma_id FROM matriculas 
        WHERE aluno_id = ? AND status = 'ativa' 
        LIMIT 1
      `, [meuId]);
      if (matricula) turmaId = matricula.turma_id;
    }

    const mensagens = await db.all(`
      SELECT DISTINCT
        m.id, m.assunto, m.conteudo, m.lida, m.data_envio,
        m.remetente_id,
        u.nome as remetente_nome,
        u.tipo as remetente_tipo,
        m.destinatario_id,
        m.turma_id
      FROM mensagens m
      JOIN usuarios u ON m.remetente_id = u.id
      WHERE 
        m.destinatario_id = ?
        OR (m.turma_id IS NOT NULL AND m.turma_id = ?)
      ORDER BY m.data_envio DESC
    `, [meuId, turmaId]);

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

app.get('/api/mensagens/enviadas', autenticar, async (req, res) => {
  try {
    const mensagens = await db.all(`
      SELECT 
        m.id, m.assunto, m.conteudo, m.data_envio,
        u.nome as destinatario_nome,
        t.nome as turma_nome
      FROM mensagens m
      LEFT JOIN usuarios u ON m.destinatario_id = u.id
      LEFT JOIN turmas t ON m.turma_id = t.id
      WHERE m.remetente_id = ?
      ORDER BY m.data_envio DESC
    `, [req.usuario.id]);

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

app.get('/api/mensagens/turma/:turmaId', autenticar, async (req, res) => {
  try {
    const { turmaId } = req.params;

    const mensagens = await db.all(`
      SELECT 
        m.id, m.assunto, m.conteudo, m.data_envio,
        u.nome as remetente_nome
      FROM mensagens m
      JOIN usuarios u ON m.remetente_id = u.id
      WHERE m.turma_id = ?
      ORDER BY m.data_envio DESC
    `, [turmaId]);

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar mensagens da turma:', error);
    res.status(500).json({ erro: 'Erro ao buscar mensagens' });
  }
});

app.put('/api/mensagens/:id/lida', autenticar, async (req, res) => {
  try {
    await db.run('UPDATE mensagens SET lida = 1 WHERE id = ?', [req.params.id]);
    res.json({ mensagem: 'Mensagem marcada como lida' });
  } catch (error) {
    console.error('Erro ao marcar mensagem:', error);
    res.status(500).json({ erro: 'Erro ao marcar mensagem' });
  }
});

app.get('/api/mensagens/conversa/:userId', autenticar, async (req, res) => {
  try {
    const meuId = req.usuario.id;
    const outroId = parseInt(req.params.userId);

    const mensagens = await db.all(`
      SELECT 
        m.id, m.assunto, m.conteudo, m.lida, m.data_envio,
        m.remetente_id, m.destinatario_id,
        u.nome as remetente_nome,
        u.tipo as remetente_tipo
      FROM mensagens m
      JOIN usuarios u ON m.remetente_id = u.id
      WHERE 
        (m.remetente_id = ? AND m.destinatario_id = ?)
        OR (m.remetente_id = ? AND m.destinatario_id = ?)
      ORDER BY m.data_envio ASC
    `, [meuId, outroId, outroId, meuId]);

    await db.run(`
      UPDATE mensagens SET lida = 1 
      WHERE remetente_id = ? AND destinatario_id = ? AND lida = 0
    `, [outroId, meuId]);

    res.json(mensagens);
  } catch (error) {
    console.error('Erro ao buscar conversa:', error);
    res.status(500).json({ erro: 'Erro ao buscar conversa' });
  }
});

app.post('/api/mensagens/responder/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { conteudo } = req.body;
    const remetenteId = req.usuario.id;

    if (!conteudo || !conteudo.trim()) {
      return res.status(400).json({ erro: 'Conteúdo é obrigatório' });
    }

    const original = await db.get('SELECT * FROM mensagens WHERE id = ?', [id]);

    if (!original) {
      return res.status(404).json({ erro: 'Mensagem não encontrada' });
    }

    const destinatarioFinal = (original.remetente_id === remetenteId)
      ? original.destinatario_id
      : original.remetente_id;

    if (!destinatarioFinal) {
      return res.status(400).json({ erro: 'Não é possível responder a esta mensagem' });
    }

    const assuntoResposta = original.assunto.startsWith('Re: ')
      ? original.assunto
      : 'Re: ' + original.assunto;

    const result = await db.run(`
      INSERT INTO mensagens (remetente_id, destinatario_id, assunto, conteudo)
      VALUES (?, ?, ?, ?)
    `, [remetenteId, destinatarioFinal, assuntoResposta, conteudo.trim()]);

    res.status(201).json({
      mensagem: 'Resposta enviada com sucesso',
      id: result.lastID
    });
  } catch (error) {
    console.error('Erro ao responder mensagem:', error);
    res.status(500).json({ erro: 'Erro ao responder mensagem' });
  }
});

app.get('/api/aluno/professores', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'aluno') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const alunoId = req.usuario.id;

    const matricula = await db.get(`
      SELECT turma_id FROM matriculas 
      WHERE aluno_id = ? AND status = 'ativa' 
      LIMIT 1
    `, [alunoId]);

    let professores = [];

    if (matricula) {
      professores = await db.all(`
        SELECT DISTINCT
          u.id,
          u.nome,
          u.email,
          d.nome as disciplina_nome
        FROM professor_disciplina_turma pdt
        JOIN usuarios u ON pdt.professor_id = u.id
        JOIN disciplinas d ON pdt.disciplina_id = d.id
        WHERE pdt.turma_id = ?
        ORDER BY u.nome, d.nome
      `, [matricula.turma_id]);
    }

    if (professores.length === 0) {
      professores = await db.all(`
        SELECT 
          id,
          nome,
          email,
          'Professor' as disciplina_nome
        FROM usuarios
        WHERE tipo = 'professor'
        ORDER BY nome
      `);
    }

    res.json(professores);
  } catch (error) {
    console.error('Erro ao buscar professores do aluno:', error);
    res.status(500).json({ erro: 'Erro ao buscar professores' });
  }
});

// ===== ROTAS DO ADMIN =====

app.get('/api/admin/estatisticas-turma/:turmaId', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turmaId } = req.params;

    const turma = await db.get('SELECT * FROM turmas WHERE id = ?', [turmaId]);
    if (!turma) {
      return res.status(404).json({ erro: 'Turma não encontrada' });
    }

    const totalAlunos = await db.get(
      'SELECT COUNT(*) as total FROM matriculas WHERE turma_id = ? AND status = "ativa"',
      [turmaId]
    );

    const statsPresencas = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN presente = 1 THEN 1 ELSE 0 END) as presencas,
        SUM(CASE WHEN presente = 0 THEN 1 ELSE 0 END) as faltas
      FROM presencas
      WHERE turma_id = ?
    `, [turmaId]);

    const disciplinasDaTurma = await db.all(`
      SELECT DISTINCT disciplina_id FROM notas WHERE turma_id = ?
    `, [turmaId]);

    const mediasCalculadas = [];

    for (const disc of disciplinasDaTurma) {
      const notasDisc = await db.all(`
        SELECT aluno_id, trimestre, tipo_avaliacao, nota
        FROM notas
        WHERE turma_id = ? AND disciplina_id = ?
      `, [turmaId, disc.disciplina_id]);

      const alunosMap = {};
      notasDisc.forEach(n => {
        if (!alunosMap[n.aluno_id]) alunosMap[n.aluno_id] = {};
        const key = `T${n.trimestre}_${n.tipo_avaliacao}`;
        alunosMap[n.aluno_id][key] = n.nota;
      });

      let somaMedias = 0;
      let countMedias = 0;
      Object.values(alunosMap).forEach(notasAluno => {
        for (let t = 1; t <= 3; t++) {
          const a1 = notasAluno[`T${t}_ACS1`];
          const a2 = notasAluno[`T${t}_ACS2`];
          const at = notasAluno[`T${t}_AT`];
          if (a1 !== undefined && a2 !== undefined && at !== undefined) {
            const media = (a1 * 0.3) + (a2 * 0.3) + (at * 0.4);
            somaMedias += media;
            countMedias++;
          }
        }
      });

      const discInfo = await db.get('SELECT nome FROM disciplinas WHERE id = ?', [disc.disciplina_id]);

      mediasCalculadas.push({
        disciplina_id: disc.disciplina_id,
        disciplina_nome: discInfo ? discInfo.nome : 'N/A',
        total_alunos: Object.keys(alunosMap).length,
        media: countMedias > 0 ? Math.round((somaMedias / countMedias) * 100) / 100 : null
      });
    }

    const mediasValidas = mediasCalculadas.filter(m => m.media !== null);
    const mediaGeral = mediasValidas.length > 0
      ? Math.round((mediasValidas.reduce((acc, m) => acc + m.media, 0) / mediasValidas.length) * 100) / 100
      : null;

    res.json({
      turma: { id: turma.id, nome: turma.nome, ano: turma.ano, turno: turma.turno },
      total_alunos: totalAlunos.total,
      assiduidade: {
        total: statsPresencas.total || 0,
        presencas: statsPresencas.presencas || 0,
        faltas: statsPresencas.faltas || 0,
        percentual: statsPresencas.total > 0
          ? Math.round((statsPresencas.presencas / statsPresencas.total) * 100)
          : 100
      },
      media_geral: mediaGeral,
      medias_por_disciplina: mediasCalculadas
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

app.get('/api/admin/notas-turma/:turmaId/:disciplinaId', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turmaId, disciplinaId } = req.params;

    const alunos = await db.all(`
      SELECT u.id, u.nome, u.email
      FROM usuarios u
      JOIN matriculas m ON u.id = m.aluno_id
      WHERE m.turma_id = ? AND m.status = 'ativa' AND u.tipo = 'aluno'
      ORDER BY u.nome
    `, [turmaId]);

    const notas = await db.all(`
      SELECT aluno_id, trimestre, tipo_avaliacao, nota
      FROM notas
      WHERE turma_id = ? AND disciplina_id = ?
    `, [turmaId, disciplinaId]);

    const resultado = alunos.map(aluno => {
      const notasAluno = {};
      notas.filter(n => n.aluno_id === aluno.id).forEach(n => {
        notasAluno[`T${n.trimestre}_${n.tipo_avaliacao}`] = n.nota;
      });

      const trimestres = {};
      for (let t = 1; t <= 3; t++) {
        const a1 = notasAluno[`T${t}_ACS1`];
        const a2 = notasAluno[`T${t}_ACS2`];
        const at = notasAluno[`T${t}_AT`];

        let media = null;
        if (a1 !== undefined && a2 !== undefined && at !== undefined) {
          media = Math.round(((a1 * 0.3) + (a2 * 0.3) + (at * 0.4)) * 100) / 100;
        }

        trimestres[`T${t}`] = {
          ACS1: a1 !== undefined ? a1 : null,
          ACS2: a2 !== undefined ? a2 : null,
          AT: at !== undefined ? at : null,
          media
        };
      }

      return {
        aluno_id: aluno.id,
        aluno_nome: aluno.nome,
        aluno_email: aluno.email,
        trimestres
      };
    });

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar notas:', error);
    res.status(500).json({ erro: 'Erro ao buscar notas' });
  }
});

app.get('/api/admin/presencas-turma/:turmaId', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { turmaId } = req.params;

    const porAluno = await db.all(`
      SELECT 
        u.id as aluno_id,
        u.nome as aluno_nome,
        COUNT(*) as total,
        SUM(CASE WHEN p.presente = 1 THEN 1 ELSE 0 END) as presencas,
        SUM(CASE WHEN p.presente = 0 THEN 1 ELSE 0 END) as faltas
      FROM presencas p
      JOIN usuarios u ON p.aluno_id = u.id
      WHERE p.turma_id = ?
      GROUP BY u.id, u.nome
      ORDER BY u.nome
    `, [turmaId]);

    const resultado = porAluno.map(a => ({
      ...a,
      percentual: a.total > 0 ? Math.round((a.presencas / a.total) * 100) : 100
    }));

    res.json(resultado);
  } catch (error) {
    console.error('Erro ao buscar presenças:', error);
    res.status(500).json({ erro: 'Erro ao buscar presenças' });
  }
});

app.get('/api/admin/destinatarios', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const professores = await db.all(`
      SELECT id, nome, email, 'professor' as tipo
      FROM usuarios
      WHERE tipo = 'professor'
      ORDER BY nome
    `);

    const pais = await db.all(`
      SELECT 
        p.id, p.nome, p.email, 'pai' as tipo,
        GROUP_CONCAT(a.nome, ', ') as filhos
      FROM usuarios p
      LEFT JOIN pais_alunos pa ON p.id = pa.pai_id
      LEFT JOIN usuarios a ON pa.aluno_id = a.id
      WHERE p.tipo = 'pai'
      GROUP BY p.id, p.nome, p.email
      ORDER BY p.nome
    `);

    const turmas = await db.all(`
      SELECT id, nome, 'turma' as tipo FROM turmas ORDER BY nome
    `);

    res.json({ professores, pais, turmas });
  } catch (error) {
    console.error('Erro ao buscar destinatários:', error);
    res.status(500).json({ erro: 'Erro ao buscar destinatários' });
  }
});

app.post('/api/admin/comunicado', autenticar, async (req, res) => {
  try {
    if (req.usuario.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const { destinatarios, assunto, conteudo } = req.body;

    if (!destinatarios || !Array.isArray(destinatarios) || destinatarios.length === 0) {
      return res.status(400).json({ erro: 'Selecione pelo menos 1 destinatário' });
    }

    if (!assunto || !conteudo) {
      return res.status(400).json({ erro: 'Assunto e conteúdo são obrigatórios' });
    }

    let enviados = 0;

    for (const dest of destinatarios) {
      if (dest.tipo === 'turma') {
        const alunos = await db.all(
          'SELECT aluno_id FROM matriculas WHERE turma_id = ? AND status = "ativa"',
          [dest.id]
        );

        for (const aluno of alunos) {
          await db.run(
            `INSERT INTO mensagens (remetente_id, destinatario_id, assunto, conteudo)
             VALUES (?, ?, ?, ?)`,
            [req.usuario.id, aluno.aluno_id, assunto, conteudo]
          );
          enviados++;
        }
      } else {
        await db.run(
          `INSERT INTO mensagens (remetente_id, destinatario_id, assunto, conteudo)
           VALUES (?, ?, ?, ?)`,
          [req.usuario.id, dest.id, assunto, conteudo]
        );
        enviados++;
      }
    }

    res.status(201).json({
      mensagem: `Comunicado enviado para ${enviados} destinatário(s)`,
      enviados
    });
  } catch (error) {
    console.error('Erro ao enviar comunicado:', error);
    res.status(500).json({ erro: 'Erro ao enviar comunicado' });
  }
});

// ===== ROTA DE SAÚDE =====

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    versao: '1.0.0'
  });
});

// ===== ROTA PRINCIPAL =====

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontand', 'index.html'));
});

// ===== MIDDLEWARES DE ERRO =====

app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

// ===== INICIAR SERVIDOR =====

async function startServer() {
  await initDatabase();

  // ✅ CORREÇÃO PARA RENDER: escutar em 0.0.0.0
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log('\n📋 Credenciais:');
    console.log('  👨‍💼 Admin: admin@escola.com / admin123');
    console.log('  👨‍🏫 Professor: professor@escola.com / prof123');
    console.log('  👨‍👦 Pai: pai@escola.com / pai123');
    console.log('  👨‍🎓 Aluno: joao@aluno.com / aluno123');
  });
}

startServer();

module.exports = app;