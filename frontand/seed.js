// seed.js - Executar para popular o banco com dados de demonstração
const db = require('./src/config/database');
const bcrypt = require('bcrypt');

async function seedDatabase() {
    try {
        console.log('🌱 Populando banco com dados de demonstração...');

        // Criar usuários
        const senhaHash = await bcrypt.hash('prof123', 10);
        const senhaHashPai = await bcrypt.hash('pai123', 10);

        // Professor
        await db.runAsync(
            `INSERT OR IGNORE INTO usuarios (nome, email, senha, tipo) 
       VALUES (?, ?, ?, ?)`,
            ['Professor Carlos', 'professor@escola.com', senhaHash, 'professor']
        );

        // Pai
        await db.runAsync(
            `INSERT OR IGNORE INTO usuarios (nome, email, senha, tipo) 
       VALUES (?, ?, ?, ?)`,
            ['António Silva', 'pai@escola.com', senhaHashPai, 'pai']
        );

        // Alunos
        const alunos = [
            ['João Silva', 'joao@email.com', 'aluno'],
            ['Maria Santos', 'maria@email.com', 'aluno'],
            ['Pedro Costa', 'pedro@email.com', 'aluno'],
        ];

        for (const [nome, email, tipo] of alunos) {
            const hash = await bcrypt.hash('aluno123', 10);
            await db.runAsync(
                `INSERT OR IGNORE INTO usuarios (nome, email, senha, tipo) 
         VALUES (?, ?, ?, ?)`,
                [nome, email, hash, tipo]
            );
        }

        console.log('✅ Dados de demonstração inseridos com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao popular banco:', error);
    }
}

seedDatabase();