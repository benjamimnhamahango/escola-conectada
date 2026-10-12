// ========================================
// SCRIPT.JS - Funções Comuns
// ========================================

const API_URL = '/api';
let token = localStorage.getItem('token');
let usuarioAtual = JSON.parse(localStorage.getItem('usuario') || 'null');

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

async function apiRequest(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            if (response.status === 401) {
                showToast('Sessão expirada. Faça login novamente.', 'error');
                logout();
            }
            throw new Error(data.erro || data.message || 'Erro na requisição');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

async function fazerLogin(email, senha) {
    try {
        console.log('🔐 Tentando login:', email);
        
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, senha })
        });
        
        console.log('✅ Login bem-sucedido:', data);

        token = data.token;
        usuarioAtual = data.usuario;
        localStorage.setItem('token', token);
        localStorage.setItem('usuario', JSON.stringify(usuarioAtual));

        showToast('Login realizado com sucesso!', 'success');

        // ===== REDIRECIONAMENTO POR TIPO DE USUÁRIO =====
        if (usuarioAtual.tipo === 'professor') {
            window.location.href = '/dashboard-professor.html';
        } else if (usuarioAtual.tipo === 'pai') {
            window.location.href = '/dashboard-pai.html';
        } else if (usuarioAtual.tipo === 'admin') {
            window.location.href = '/dashboard-admin.html';
        } else if (usuarioAtual.tipo === 'aluno') {
            window.location.href = '/dashboard-aluno.html';
        } else {
            window.location.href = '/dashboard-professor.html';
        }
    } catch (error) {
        console.error('❌ Erro no login:', error);
        showToast('Erro: ' + error.message, 'error');
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    token = null;
    usuarioAtual = null;
    window.location.href = '/';
}

function verificarAuth() {
    if (!token || !usuarioAtual) {
        window.location.href = '/';
        return false;
    }
    return true;
}

function formatarData(data) {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleDateString('pt-PT');
}

function formatarDataHora(data) {
    if (!data) return '-';
    const d = new Date(data);
    return d.toLocaleString('pt-PT');
}

function exportarCSV() {
    const tabela = document.querySelector('#tabAlunos table');
    if (!tabela) return;

    let csv = '';
    const linhas = tabela.querySelectorAll('tr');
    linhas.forEach(linha => {
        const celulas = linha.querySelectorAll('td, th');
        const valores = Array.from(celulas).map(celula => {
            return `"${celula.textContent.trim().replace(/"/g, '""')}"`;
        });
        csv += valores.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alunos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    showToast('CSV exportado com sucesso!', 'success');
}

// ===== FUNÇÃO DE DEMONSTRAÇÃO =====
function loginDemo(tipo) {
    const demoUsers = {
        professor: { email: 'professor@escola.com', senha: 'prof123' },
        pai: { email: 'pai@escola.com', senha: 'pai123' },
        admin: { email: 'admin@escola.com', senha: 'admin123' },
        aluno: { email: 'joao@aluno.com', senha: 'aluno123' }
    };

    const user = demoUsers[tipo];
    if (!user) {
        showToast('❌ Usuário não encontrado para: ' + tipo, 'error');
        return;
    }

    document.getElementById('email').value = user.email;
    document.getElementById('password').value = user.senha;
    document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}

// ===== EVENTO DE LOGIN =====
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const senha = document.getElementById('password').value;
            fazerLogin(email, senha);
        });
    }
});