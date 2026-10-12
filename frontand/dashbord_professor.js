// ========================================
// DASHBOARD-PROFESSOR.JS - API Real
// ========================================

let turmasData = [];
let turmaAtual = null;
let alunosData = [];
let disciplinasData = [];
let presencasData = {};
let notasData = {};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAuth()) return;
    if (usuarioAtual.tipo !== 'professor') {
        showToast('Acesso não autorizado', 'error');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('professorNome').textContent = usuarioAtual.nome || 'Professor';
    
    // Definir data de hoje no campo de presenças
    document.getElementById('dataPresenca').value = new Date().toISOString().split('T')[0];
    
    configurarTabs();
    configurarFormularios();
    
    await carregarTurmas();
});

// ===== TABS =====
function configurarTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            const tabId = this.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            const target = document.getElementById(`tab${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
            if (target) target.classList.add('active');

            // Carregar dados da tab
            if (tabId === 'presencas') renderizarPresencas();
            if (tabId === 'historico') {
                carregarSelectsHistorico();
                carregarHistoricoPresencas();
            }
            if (tabId === 'notas') carregarNotas();
            if (tabId === 'tpc') carregarTPCs();
            if (tabId === 'mensagens') carregarMensagens();
        });
    });
}

// ===== CARREGAR TURMAS DO PROFESSOR =====
async function carregarTurmas() {
    try {
        const response = await fetch('/api/professor/turmas', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar turmas');
        
        turmasData = await response.json();
        
        // Se não tiver turmas
        if (turmasData.length === 0) {
            document.getElementById('avisoTurmas').style.display = 'block';
            document.getElementById('turmaSelector').style.display = 'none';
            return;
        }
        
        // Mostrar selector
        document.getElementById('turmaSelector').style.display = 'flex';
        document.getElementById('avisoTurmas').style.display = 'none';
        
        // Preencher selector
        const select = document.getElementById('selectTurma');
        select.innerHTML = turmasData.map(t => 
            `<option value="${t.id}">${t.nome} - ${t.ano}º Ano (${t.turno})</option>`
        ).join('');
        
        select.addEventListener('change', (e) => {
            const turmaId = parseInt(e.target.value);
            selecionarTurma(turmaId);
        });
        
        // Carregar primeira turma
        await selecionarTurma(turmasData[0].id);
        
    } catch (error) {
        console.error('Erro ao carregar turmas:', error);
        showToast('Erro ao carregar turmas', 'error');
    }
}

// ===== SELECIONAR TURMA =====
async function selecionarTurma(turmaId) {
    turmaAtual = turmasData.find(t => t.id === turmaId);
    
    if (!turmaAtual) return;
    
    // Atualizar info da turma
    const info = document.getElementById('turmaInfo');
    info.innerHTML = `
        <span class="badge badge-info">${turmaAtual.ano}º Ano</span>
        <span class="badge ${turmaAtual.turno === 'manha' ? 'badge-info' : turmaAtual.turno === 'tarde' ? 'badge-warning' : 'badge-info'}">
            ${turmaAtual.turno === 'manha' ? '🌅 Manhã' : turmaAtual.turno === 'tarde' ? '🌤️ Tarde' : '🌙 Noite'}
        </span>
        <span>👨‍🎓 ${turmaAtual.total_alunos} alunos</span>
    `;
    
    // Atualizar stats
    document.getElementById('totalAlunos').textContent = turmaAtual.total_alunos;
    document.getElementById('totalDisciplinas').textContent = turmaAtual.disciplinas ? turmaAtual.disciplinas.length : 0;
    
    // Carregar dados
    await Promise.all([
        carregarAlunos(turmaId),
        carregarDisciplinasSelects(turmaId),
        carregarMediaTurma(turmaId),
        carregarFaltas()
    ]);
    
    // Carregar selects do histórico
    carregarSelectsHistorico();
}

// ===== CARREGAR ALUNOS DA TURMA =====
async function carregarAlunos(turmaId) {
    try {
        const response = await fetch(`/api/professor/turma/${turmaId}/alunos`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        alunosData = await response.json();
        renderizarAlunos();
        
    } catch (error) {
        console.error('Erro ao carregar alunos:', error);
        document.getElementById('alunosTable').innerHTML = 
            '<tr><td colspan="4" class="text-center">Erro ao carregar alunos</td></tr>';
    }
}

function renderizarAlunos() {
    const tbody = document.getElementById('alunosTable');
    
    if (alunosData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum aluno nesta turma</td></tr>';
        return;
    }
    
    tbody.innerHTML = alunosData.map((aluno, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${aluno.nome}</strong></td>
            <td>${aluno.email}</td>
            <td>${aluno.telefone || '-'}</td>
        </tr>
    `).join('');
}

// ===== CARREGAR DISCIPLINAS (SELECTS) =====
async function carregarDisciplinasSelects(turmaId) {
    try {
        const disciplinas = turmaAtual.disciplinas || [];
        
        const selects = ['disciplinaPresenca', 'disciplinaNota', 'tpcDisciplina', 'historicoDisciplina'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                if (selectId === 'historicoDisciplina') {
                    select.innerHTML = '<option value="">Todas as Disciplinas</option>' +
                        disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
                } else {
                    select.innerHTML = '<option value="">Disciplina...</option>' +
                        disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
                }
            }
        });
        
    } catch (error) {
        console.error('Erro ao carregar disciplinas:', error);
    }
}

// ===== CARREGAR FALTAS =====
async function carregarFaltas() {
    try {
        if (alunosData.length === 0) {
            document.getElementById('faltasMes').textContent = '0';
            return;
        }
        
        let totalFaltas = 0;
        
        for (const aluno of alunosData) {
            const response = await fetch(`/api/presencas/aluno/${aluno.id}/estatisticas`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            
            if (response.ok) {
                const stats = await response.json();
                totalFaltas += stats.faltas || 0;
            }
        }
        
        document.getElementById('faltasMes').textContent = totalFaltas;
        
    } catch (error) {
        console.error('Erro ao carregar faltas:', error);
    }
}

// ===== CARREGAR MÉDIA DA TURMA =====
async function carregarMediaTurma(turmaId) {
    try {
        if (!turmaAtual.disciplinas || turmaAtual.disciplinas.length === 0) {
            document.getElementById('mediaTurma').textContent = '-';
            return;
        }
        
        let somaMedias = 0;
        let count = 0;
        
        for (const disciplina of turmaAtual.disciplinas) {
            const response = await fetch(
                `/api/professor/notas/${turmaId}/${disciplina.id}?trimestre=1`,
                { headers: { 'Authorization': 'Bearer ' + token } }
            );
            
            if (response.ok) {
                const notas = await response.json();
                notas.forEach(n => {
                    if (n.media !== null) {
                        somaMedias += n.media;
                        count++;
                    }
                });
            }
        }
        
        const mediaGeral = count > 0 ? (somaMedias / count).toFixed(1) : '-';
        document.getElementById('mediaTurma').textContent = mediaGeral;
        
    } catch (error) {
        console.error('Erro ao calcular média:', error);
        document.getElementById('mediaTurma').textContent = '-';
    }
}

// ========================================
// PRESENÇAS
// ========================================
function renderizarPresencas() {
    const tbody = document.getElementById('presencasTable');
    
    if (alunosData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhum aluno nesta turma</td></tr>';
        return;
    }
    
    alunosData.forEach(aluno => {
        if (presencasData[aluno.id] === undefined) {
            presencasData[aluno.id] = true;
        }
    });
    
    tbody.innerHTML = alunosData.map((aluno, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${aluno.nome}</strong></td>
            <td>
                <label class="checkbox-wrapper">
                    <input type="checkbox" class="presenca-check" data-aluno="${aluno.id}" 
                           ${presencasData[aluno.id] ? 'checked' : ''}>
                    <span class="presenca-label">${presencasData[aluno.id] ? '✅ Presente' : '❌ Falta'}</span>
                </label>
            </td>
        </tr>
    `).join('');
    
    document.querySelectorAll('.presenca-check').forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            const alunoId = this.dataset.aluno;
            const label = this.closest('.checkbox-wrapper').querySelector('.presenca-label');
            
            if (this.checked) {
                presencasData[alunoId] = true;
                label.textContent = '✅ Presente';
            } else {
                presencasData[alunoId] = false;
                label.textContent = '❌ Falta';
            }
        });
    });
}

function marcarTodosPresentes() {
    alunosData.forEach(aluno => {
        presencasData[aluno.id] = true;
    });
    renderizarPresencas();
    showToast('Todos marcados como presentes!', 'success');
}

async function salvarPresencas() {
    const disciplina_id = document.getElementById('disciplinaPresenca').value;
    const data = document.getElementById('dataPresenca').value;
    
    if (!disciplina_id) {
        showToast('Selecione uma disciplina!', 'warning');
        return;
    }
    
    if (!data) {
        showToast('Selecione uma data!', 'warning');
        return;
    }
    
    if (!turmaAtual) {
        showToast('Selecione uma turma!', 'warning');
        return;
    }
    
    try {
        const presencas = Object.keys(presencasData).map(alunoId => ({
            aluno_id: parseInt(alunoId),
            presente: presencasData[alunoId]
        }));
        
        const response = await fetch('/api/presencas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                presencas,
                turma_id: turmaAtual.id,
                disciplina_id: parseInt(disciplina_id),
                data
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.erro || 'Erro ao salvar');
        
        showToast('✅ Presenças salvas com sucesso!', 'success');
        
        await carregarFaltas();
        
    } catch (error) {
        console.error('Erro ao salvar presenças:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

// ========================================
// HISTÓRICO DE PRESENÇAS
// ========================================
function carregarSelectsHistorico() {
    const selectDisc = document.getElementById('historicoDisciplina');
    if (selectDisc && turmaAtual && turmaAtual.disciplinas) {
        selectDisc.innerHTML = '<option value="">Todas as Disciplinas</option>' +
            turmaAtual.disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');
    }
    
    const selectAluno = document.getElementById('historicoAluno');
    if (selectAluno && alunosData) {
        selectAluno.innerHTML = '<option value="">Todos os Alunos</option>' +
            alunosData.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    }
}

async function carregarHistoricoPresencas() {
    if (!turmaAtual) {
        showToast('Selecione uma turma primeiro!', 'warning');
        return;
    }
    
    const tbody = document.getElementById('historicoPresencasTable');
    if (!tbody) return;
    
    const disciplina_id = document.getElementById('historicoDisciplina')?.value || '';
    const aluno_id = document.getElementById('historicoAluno')?.value || '';
    const mes = document.getElementById('historicoMes')?.value || '';
    
    let discId = disciplina_id;
    if (!discId && turmaAtual.disciplinas && turmaAtual.disciplinas.length > 0) {
        discId = turmaAtual.disciplinas[0].id;
    }
    
    if (!discId) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhuma disciplina disponível</td></tr>';
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">A carregar...</td></tr>';
    
    try {
        const response = await fetch(`/api/professor/presencas/${turmaAtual.id}/${discId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar presenças');
        
        let presencas = await response.json();
        
        if (aluno_id) {
            presencas = presencas.filter(p => p.aluno_id === parseInt(aluno_id));
        }
        
        if (mes) {
            presencas = presencas.filter(p => {
                const data = new Date(p.data);
                const mesData = String(data.getMonth() + 1).padStart(2, '0');
                return mesData === mes;
            });
        }
        
        renderizarHistoricoPresencas(presencas);
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--danger);">Erro ao carregar</td></tr>';
    }
}

function renderizarHistoricoPresencas(presencas) {
    const tbody = document.getElementById('historicoPresencasTable');
    
    const total = presencas.length;
    const totalPresencas = presencas.filter(p => p.presente === 1).length;
    const totalFaltas = presencas.filter(p => p.presente === 0).length;
    const percentual = total > 0 ? Math.round((totalPresencas / total) * 100) : 0;
    
    document.getElementById('histTotal').textContent = total;
    document.getElementById('histPresencas').textContent = totalPresencas;
    document.getElementById('histFaltas').textContent = totalFaltas;
    document.getElementById('histPercentual').textContent = percentual + '%';
    
    if (total === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="color: var(--gray-400);">Sem presenças registadas</td></tr>';
        return;
    }
    
    tbody.innerHTML = presencas.map(p => {
        const data = new Date(p.data);
        const dataFormatada = data.toLocaleDateString('pt-PT');
        
        return `
            <tr>
                <td>${dataFormatada}</td>
                <td><strong>${p.aluno_nome || '-'}</strong></td>
                <td>${p.disciplina_nome || '-'}</td>
                <td>${p.turma_nome || '-'}</td>
                <td>
                    <span class="${p.presente === 1 ? 'badge-presente' : 'badge-falta'}">
                        ${p.presente === 1 ? '✅ Presente' : '❌ Falta'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// ========================================
// NOTAS
// ========================================
async function carregarNotas() {
    const disciplina_id = document.getElementById('disciplinaNota').value;
    const trimestre = document.getElementById('trimestreNota').value;
    const tbody = document.getElementById('notasTable');
    
    if (!disciplina_id || !trimestre || !turmaAtual) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Selecione disciplina e trimestre</td></tr>';
        return;
    }
    
    try {
        const response = await fetch(
            `/api/professor/notas/${turmaAtual.id}/${disciplina_id}?trimestre=${trimestre}`,
            { headers: { 'Authorization': 'Bearer ' + token } }
        );
        
        if (!response.ok) throw new Error('Erro ao carregar notas');
        
        const notas = await response.json();
        
        const notasFormatadas = notas.map(item => ({
            aluno_id: item.aluno_id,
            aluno_nome: item.aluno_nome,
            ACS1: item.notas[`T${trimestre}_ACS1`] !== undefined ? item.notas[`T${trimestre}_ACS1`] : null,
            ACS2: item.notas[`T${trimestre}_ACS2`] !== undefined ? item.notas[`T${trimestre}_ACS2`] : null,
            AT: item.notas[`T${trimestre}_AT`] !== undefined ? item.notas[`T${trimestre}_AT`] : null,
            media: item.media
        }));
        
        renderizarNotas(notasFormatadas);
        
    } catch (error) {
        console.error('Erro ao carregar notas:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Erro ao carregar notas</td></tr>';
    }
}

function renderizarNotas(notas) {
    const tbody = document.getElementById('notasTable');
    
    if (!notas || notas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum aluno matriculado</td></tr>';
        return;
    }
    
    tbody.innerHTML = notas.map((item, index) => {
        const media = item.media !== null ? item.media.toFixed(1) : '-';
        const mediaClass = item.media !== null ? (item.media >= 10 ? 'media-boa' : 'media-fraca') : '';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${item.aluno_nome}</strong></td>
                <td>
                    <input type="number" class="nota-input" 
                           data-aluno="${item.aluno_id}" 
                           data-tipo="ACS1"
                           value="${item.ACS1 !== null ? item.ACS1 : ''}"
                           min="0" max="20" step="0.5"
                           style="width: 70px; padding: 6px 8px; border: 1px solid var(--gray-200); border-radius: 6px; text-align: center;">
                </td>
                <td>
                    <input type="number" class="nota-input" 
                           data-aluno="${item.aluno_id}" 
                           data-tipo="ACS2"
                           value="${item.ACS2 !== null ? item.ACS2 : ''}"
                           min="0" max="20" step="0.5"
                           style="width: 70px; padding: 6px 8px; border: 1px solid var(--gray-200); border-radius: 6px; text-align: center;">
                </td>
                <td>
                    <input type="number" class="nota-input" 
                           data-aluno="${item.aluno_id}" 
                           data-tipo="AT"
                           value="${item.AT !== null ? item.AT : ''}"
                           min="0" max="20" step="0.5"
                           style="width: 70px; padding: 6px 8px; border: 1px solid var(--gray-200); border-radius: 6px; text-align: center;">
                </td>
                <td class="media-cell ${mediaClass}">
                    ${media}
                </td>
            </tr>
        `;
    }).join('');
    
    document.querySelectorAll('.nota-input').forEach(input => {
        input.addEventListener('input', calcularMediasTempoReal);
    });
}

function calcularMediasTempoReal() {
    const alunos = {};
    
    document.querySelectorAll('.nota-input').forEach(input => {
        const alunoId = input.dataset.aluno;
        const tipo = input.dataset.tipo;
        const valor = parseFloat(input.value);
        
        if (!alunos[alunoId]) {
            alunos[alunoId] = { ACS1: null, ACS2: null, AT: null };
        }
        
        if (!isNaN(valor)) {
            alunos[alunoId][tipo] = valor;
        }
    });
    
    Object.keys(alunos).forEach(alunoId => {
        const notas = alunos[alunoId];
        let media = '-';
        let mediaClass = '';
        
        if (notas.ACS1 !== null && notas.ACS2 !== null && notas.AT !== null) {
            const mediaCalc = (notas.ACS1 * 0.3) + (notas.ACS2 * 0.3) + (notas.AT * 0.4);
            media = mediaCalc.toFixed(1);
            mediaClass = mediaCalc >= 10 ? 'media-boa' : 'media-fraca';
        }
        
        const primeiraInput = document.querySelector(`.nota-input[data-aluno="${alunoId}"]`);
        if (primeiraInput) {
            const linha = primeiraInput.closest('tr');
            const celulaMedia = linha.querySelector('.media-cell');
            if (celulaMedia) {
                celulaMedia.textContent = media;
                celulaMedia.className = `media-cell ${mediaClass}`;
            }
        }
    });
}

async function salvarNotas() {
    const disciplina_id = document.getElementById('disciplinaNota').value;
    const trimestre = document.getElementById('trimestreNota').value;
    
    if (!disciplina_id || !trimestre || !turmaAtual) {
        showToast('Selecione disciplina e trimestre!', 'warning');
        return;
    }
    
    try {
        const alunos = {};
        
        document.querySelectorAll('.nota-input').forEach(input => {
            const alunoId = input.dataset.aluno;
            const tipo = input.dataset.tipo;
            const valor = parseFloat(input.value);
            
            if (!alunos[alunoId]) {
                alunos[alunoId] = { aluno_id: parseInt(alunoId), ACS1: null, ACS2: null, AT: null };
            }
            
            if (!isNaN(valor) && valor >= 0 && valor <= 20) {
                alunos[alunoId][tipo] = valor;
            }
        });
        
        const notas = Object.values(alunos);
        
        const response = await fetch('/api/notas/lote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                notas,
                disciplina_id: parseInt(disciplina_id),
                turma_id: turmaAtual.id,
                trimestre: parseInt(trimestre)
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.erro || 'Erro ao salvar');
        
        showToast('✅ Notas salvas com sucesso!', 'success');
        
        await carregarNotas();
        await carregarMediaTurma(turmaAtual.id);
        
    } catch (error) {
        console.error('Erro ao salvar notas:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

// ========================================
// TPCs
// ========================================
async function carregarTPCs() {
    if (!turmaAtual) return;
    
    const container = document.getElementById('tpcLista');
    
    try {
        const response = await fetch(`/api/professor/tpc?turma_id=${turmaAtual.id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const tpcs = await response.json();
        
        if (tpcs.length === 0) {
            container.innerHTML = '<div class="empty-msg">Sem TPCs publicados</div>';
            return;
        }
        
        container.innerHTML = tpcs.map(tpc => `
            <div style="padding: 12px 16px; border-left: 4px solid var(--primary); background: var(--gray-50); border-radius: var(--radius); margin-bottom: 8px;">
                <div style="font-weight: 600; font-size: 15px;">📝 ${tpc.titulo}</div>
                ${tpc.descricao ? `<div style="font-size: 14px; color: var(--gray-600); margin-top: 4px;">${tpc.descricao}</div>` : ''}
                <div style="font-size: 12px; color: var(--gray-400); margin-top: 6px;">
                    📖 ${tpc.disciplina_nome} • 📅 Entrega: ${formatarData(tpc.data_entrega)}
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="btn btn-primary btn-sm" onclick="abrirModalEntregas(${tpc.id}, '${tpc.titulo.replace(/'/g, "\\'")}')">
                        👁️ Ver Entregas
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletarTPC(${tpc.id})">🗑️ Remover</button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Erro ao carregar TPCs:', error);
        container.innerHTML = '<div class="empty-msg">Erro ao carregar TPCs</div>';
    }
}

async function deletarTPC(id) {
    if (!confirm('Remover este TPC?')) return;
    
    try {
        const response = await fetch(`/api/tpc/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        showToast('TPC removido', 'success');
        await carregarTPCs();
        
    } catch (error) {
        showToast('Erro ao remover TPC', 'error');
    }
}

// ========================================
// MODAL DE ENTREGAS DE TPC
// ========================================

async function abrirModalEntregas(tpcId, tituloTpc) {
    const modal = document.getElementById('modalEntregas');
    const tbody = document.getElementById('entregasTable');
    const titulo = document.getElementById('modalTitulo');
    const info = document.getElementById('modalTpcInfo');
    const stats = document.getElementById('modalStats');
    
    if (!modal) return;
    
    modal.classList.add('active');
    titulo.textContent = `📝 Entregas: ${tituloTpc}`;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">A carregar...</td></tr>';
    info.innerHTML = '';
    stats.innerHTML = '';
    
    try {
        const response = await fetch(`/api/tpc/${tpcId}/entregas`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar entregas');
        
        const data = await response.json();
        
        info.innerHTML = `
            <div style="font-weight: 600; font-size: 15px;">📝 ${data.tpc.titulo}</div>
            ${data.tpc.descricao ? `<div style="font-size: 13px; color: var(--gray-600); margin-top: 4px;">${data.tpc.descricao}</div>` : ''}
            <div style="font-size: 12px; color: var(--gray-400); margin-top: 4px;">
                📅 Data de Entrega: ${formatarData(data.tpc.data_entrega)}
            </div>
        `;
        
        stats.innerHTML = `
            <div style="text-align: center; padding: 8px; background: var(--white); border-radius: var(--radius);">
                <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${data.stats.total}</div>
                <div style="font-size: 12px; color: var(--gray-500);">👥 Total</div>
            </div>
            <div style="text-align: center; padding: 8px; background: var(--white); border-radius: var(--radius);">
                <div style="font-size: 20px; font-weight: 700; color: var(--success);">${data.stats.entregues}</div>
                <div style="font-size: 12px; color: var(--gray-500);">✅ Entregues</div>
            </div>
            <div style="text-align: center; padding: 8px; background: var(--white); border-radius: var(--radius);">
                <div style="font-size: 20px; font-weight: 700; color: var(--warning);">${data.stats.pendentes}</div>
                <div style="font-size: 12px; color: var(--gray-500);">⏳ Pendentes</div>
            </div>
        `;
        
        window.tpcAtualId = tpcId;
        window.tpcAtualTitulo = tituloTpc;
        
        renderizarEntregas(data.entregas);
        
    } catch (error) {
        console.error('Erro ao carregar entregas:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color: var(--danger);">Erro ao carregar entregas</td></tr>';
    }
}

function renderizarEntregas(entregas) {
    const tbody = document.getElementById('entregasTable');
    
    if (entregas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum aluno matriculado</td></tr>';
        return;
    }
    
    tbody.innerHTML = entregas.map((e, index) => {
        let badgeClass = 'badge-pendente';
        let badgeTexto = '⏳ Pendente';
        
        if (e.marcado_professor === 1 || e.marcado_professor === true) {
            if (e.entregue) {
                badgeClass = 'badge-entregue';
                badgeTexto = '✅ Entregue';
            } else {
                badgeClass = 'badge-falta';
                badgeTexto = '❌ Não Entregue';
            }
        }
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${e.aluno_nome}</strong></td>
                <td>
                    <span class="${badgeClass}">
                        ${badgeTexto}
                    </span>
                </td>
                <td>
                    <input type="number" class="entrega-nota-input" 
                           id="nota-${e.aluno_id}" 
                           value="${e.nota !== null ? e.nota : ''}" 
                           min="0" max="20" step="0.5" 
                           placeholder="-">
                </td>
                <td>
                    <input type="text" class="entrega-comentario-input" 
                           id="comentario-${e.aluno_id}" 
                           value="${e.comentario || ''}" 
                           placeholder="Comentário...">
                </td>
                <td>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-success btn-sm" 
                                onclick="marcarEntrega(${e.aluno_id}, true)"
                                title="Marcar como Entregue">✅</button>
                        <button class="btn btn-danger btn-sm" 
                                onclick="marcarEntrega(${e.aluno_id}, false)"
                                title="Marcar como Não Entregue">❌</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function marcarEntrega(alunoId, entregue) {
    if (!window.tpcAtualId) {
        showToast('Erro: TPC não identificado', 'error');
        return;
    }
    
    const notaInput = document.getElementById(`nota-${alunoId}`);
    const comentarioInput = document.getElementById(`comentario-${alunoId}`);
    
    const nota = notaInput?.value ? parseFloat(notaInput.value) : null;
    const comentario = comentarioInput?.value || null;
    
    try {
        const response = await fetch(`/api/tpc/${window.tpcAtualId}/entrega/${alunoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                entregue: entregue,
                nota: nota,
                comentario: comentario
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.erro || 'Erro ao marcar entrega');
        
        showToast(entregue ? '✅ Marcado como entregue!' : '❌ Marcado como não entregue', 'success');
        
        abrirModalEntregas(window.tpcAtualId, window.tpcAtualTitulo);
        
    } catch (error) {
        console.error('Erro ao marcar entrega:', error);
        showToast('❌ ' + error.message, 'error');
    }
}

function fecharModalEntregas() {
    const modal = document.getElementById('modalEntregas');
    if (modal) {
        modal.classList.remove('active');
    }
}

document.addEventListener('click', function (e) {
    const modal = document.getElementById('modalEntregas');
    if (modal && e.target === modal) {
        fecharModalEntregas();
    }
});

// ========================================
// MENSAGENS (RECEBIDAS E ENVIADAS)
// ========================================
async function carregarMensagens() {
    const container = document.getElementById('mensagensLista');
    
    try {
        const [responseRecebidas, responseEnviadas] = await Promise.all([
            fetch('/api/mensagens/recebidas', {
                headers: { 'Authorization': 'Bearer ' + token }
            }),
            fetch('/api/mensagens/enviadas', {
                headers: { 'Authorization': 'Bearer ' + token }
            })
        ]);
        
        const recebidas = responseRecebidas.ok ? await responseRecebidas.json() : [];
        const enviadas = responseEnviadas.ok ? await responseEnviadas.json() : [];
        
        if (recebidas.length === 0 && enviadas.length === 0) {
            container.innerHTML = '<div class="empty-msg">Sem mensagens</div>';
            return;
        }
        
        let html = '';
        
        // ===== MENSAGENS RECEBIDAS =====
        if (recebidas.length > 0) {
            html += '<h4 style="margin-bottom: 12px; color: var(--primary);">📥 Mensagens Recebidas</h4>';
            html += recebidas.map(msg => `
                <div style="padding: 12px 16px; border-left: 4px solid var(--primary); background: #e0e7ff; border-radius: var(--radius); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <div style="font-weight: 600; font-size: 13px; color: var(--gray-500);">
                            📩 De: ${msg.remetente_nome} (${msg.remetente_tipo})
                        </div>
                        <div style="font-weight: 600; color: var(--primary); font-size: 14px; margin-top: 2px;">${msg.assunto}</div>
                        <div style="font-size: 14px; margin-top: 4px;">${msg.conteudo}</div>
                        <div style="font-size: 12px; color: var(--gray-400); margin-top: 4px;">${formatarDataHora(msg.data_envio)}</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="abrirConversaProfessor(${msg.remetente_id}, '${msg.remetente_nome.replace(/'/g, "\\'")}', ${msg.id})">
                        💬 Responder
                    </button>
                </div>
            `).join('');
        }
        
        // ===== MENSAGENS ENVIADAS =====
        if (enviadas.length > 0) {
            html += '<h4 style="margin: 24px 0 12px 0; color: var(--secondary);">📤 Mensagens Enviadas</h4>';
            html += enviadas.map(msg => `
                <div style="padding: 12px 16px; border-left: 4px solid var(--secondary); background: var(--gray-50); border-radius: var(--radius); margin-bottom: 8px;">
                    <div style="font-weight: 600; font-size: 13px; color: var(--gray-500);">
                        📤 Para: ${msg.destinatario_nome || msg.turma_nome || 'Turma'}
                    </div>
                    <div style="font-weight: 600; color: var(--primary); font-size: 14px; margin-top: 2px;">${msg.assunto}</div>
                    <div style="font-size: 14px; margin-top: 4px;">${msg.conteudo}</div>
                    <div style="font-size: 12px; color: var(--gray-400); margin-top: 4px;">${formatarDataHora(msg.data_envio)}</div>
                </div>
            `).join('');
        }
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        container.innerHTML = '<div class="empty-msg">Erro ao carregar mensagens</div>';
    }
}

// ===== ABRIR CONVERSA (PROFESSOR) =====
async function abrirConversaProfessor(userId, userName, mensagemId) {
    let modal = document.getElementById('modalConversa');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalConversa';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9;">
                    <h3 id="modalConversaTitulo" style="margin: 0;">💬 Conversa com ${userName}</h3>
                    <button onclick="fecharModalConversa()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #94a3b8;">&times;</button>
                </div>
                <div id="conversaMensagens" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px; padding: 8px 0;">
                    <div style="text-align: center; padding: 30px; color: #94a3b8;">A carregar...</div>
                </div>
                <form id="formResponderProfessor" style="display: flex; gap: 8px;">
                    <textarea id="respostaProfessorConteudo" placeholder="Escreva sua resposta..." style="flex: 1; min-height: 60px; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-family: 'Poppins', sans-serif; resize: vertical;" required></textarea>
                    <button type="submit" class="btn btn-primary" style="align-self: flex-end;">📤 Enviar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('formResponderProfessor').addEventListener('submit', async (e) => {
            e.preventDefault();
            await enviarRespostaProfessor();
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) fecharModalConversa();
        });
    } else {
        document.getElementById('modalConversaTitulo').textContent = `💬 Conversa com ${userName}`;
        modal.style.display = 'flex';
    }
    
    window.conversaUserId = userId;
    window.mensagemOriginalId = mensagemId;
    await carregarConversaProfessor(userId);
}

async function carregarConversaProfessor(userId) {
    const container = document.getElementById('conversaMensagens');
    
    try {
        const response = await fetch(`/api/mensagens/conversa/${userId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const mensagens = await response.json();
        
        if (mensagens.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: #94a3b8;">Sem mensagens nesta conversa</div>';
            return;
        }
        
        container.innerHTML = mensagens.map(msg => {
            const isMeu = msg.remetente_id === usuarioAtual.id;
            const cor = isMeu ? '#1a2a6c' : '#f97316';
            const align = isMeu ? 'flex-end' : 'flex-start';
            const bg = isMeu ? '#e0e7ff' : '#fef3c7';
            
            return `
                <div style="display: flex; flex-direction: column; align-items: ${align}; margin-bottom: 12px;">
                    <div style="max-width: 80%; padding: 10px 14px; background: ${bg}; border-radius: 12px; border-left: 3px solid ${cor};">
                        <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">
                            ${isMeu ? '👤 Eu' : '📩 ' + msg.remetente_nome}
                        </div>
                        <div style="font-weight: 600; font-size: 13px; color: ${cor}; margin-bottom: 4px;">${msg.assunto}</div>
                        <div style="font-size: 14px;">${msg.conteudo}</div>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${formatarDataHora(msg.data_envio)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Erro:', error);
        container.innerHTML = '<div style="text-align: center; padding: 30px; color: #ef4444;">Erro ao carregar conversa</div>';
    }
}

function fecharModalConversa() {
    const modal = document.getElementById('modalConversa');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function enviarRespostaProfessor() {
    const conteudo = document.getElementById('respostaProfessorConteudo').value.trim();
    
    if (!conteudo || !window.mensagemOriginalId) {
        showToast('Escreva uma mensagem!', 'warning');
        return;
    }
    
    try {
        // ✅ Usar a rota específica de resposta
        const response = await fetch(`/api/mensagens/responder/${window.mensagemOriginalId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                conteudo: conteudo
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.erro || 'Erro ao enviar');
        
        document.getElementById('respostaProfessorConteudo').value = '';
        await carregarConversaProfessor(window.conversaUserId);
        await carregarMensagens();
        showToast('✅ Resposta enviada!', 'success');
        
    } catch (error) {
        showToast('❌ ' + error.message, 'error');
    }
}

// ========================================
// DESTINATÁRIOS DE MENSAGENS
// ========================================

async function carregarDestinatarios() {
    const selectPai = document.getElementById('paiSelect');
    const selectAluno = document.getElementById('alunoSelect');
    
    try {
        const response = await fetch('/api/mensagens/destinatarios', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const data = await response.json();
        
        if (selectPai && data.pais) {
            selectPai.innerHTML = '<option value="">Selecione um pai...</option>' +
                data.pais.map(p => `<option value="${p.id}">${p.nome} (${p.filho_nome || 'filho'})</option>`).join('');
        }
        
        if (selectAluno && data.alunos) {
            selectAluno.innerHTML = '<option value="">Selecione um aluno...</option>' +
                data.alunos.map(a => `<option value="${a.id}">${a.nome} (${a.turma_nome || 'turma'})</option>`).join('');
        }
        
    } catch (error) {
        console.error('Erro ao carregar destinatários:', error);
        if (selectPai) selectPai.innerHTML = '<option value="">Erro ao carregar</option>';
        if (selectAluno) selectAluno.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function configurarSelectDestinatarios() {
    const selectDestino = document.getElementById('mensagemDestino');
    if (!selectDestino) return;
    
    selectDestino.addEventListener('change', function () {
        const grupoPai = document.getElementById('paiEspecificoGroup');
        const grupoAluno = document.getElementById('alunoEspecificoGroup');
        
        grupoPai.style.display = 'none';
        grupoAluno.style.display = 'none';
        
        if (this.value === 'pai_especifico') {
            grupoPai.style.display = 'block';
            carregarDestinatarios();
        } else if (this.value === 'aluno_especifico') {
            grupoAluno.style.display = 'block';
            carregarDestinatarios();
        }
    });
}

async function obterDestinatariosMultiplos(tipo) {
    try {
        const response = await fetch('/api/mensagens/destinatarios', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const data = await response.json();
        
        if (tipo === 'todos_pais') {
            return data.pais || [];
        } else if (tipo === 'todos_alunos') {
            return data.alunos || [];
        } else if (tipo === 'pais_alunos') {
            return [...(data.pais || []), ...(data.alunos || [])];
        }
        
        return [];
    } catch (error) {
        console.error('Erro ao obter destinatários:', error);
        return [];
    }
}

// ========================================
// FORMULÁRIOS
// ========================================
function configurarFormularios() {
    document.getElementById('tpcForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!turmaAtual) {
            showToast('Selecione uma turma primeiro!', 'warning');
            return;
        }
        
        const disciplina_id = document.getElementById('tpcDisciplina').value;
        const titulo = document.getElementById('tpcTitulo').value.trim();
        const descricao = document.getElementById('tpcDescricao').value.trim();
        const data_entrega = document.getElementById('tpcData').value;
        
        if (!disciplina_id || !titulo || !data_entrega) {
            showToast('Preencha todos os campos obrigatórios!', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/tpc', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    titulo,
                    descricao,
                    disciplina_id: parseInt(disciplina_id),
                    turma_id: turmaAtual.id,
                    data_entrega
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.erro || 'Erro');
            
            showToast('✅ TPC publicado!', 'success');
            e.target.reset();
            await carregarTPCs();
            
        } catch (error) {
            showToast('❌ ' + error.message, 'error');
        }
    });
    
    configurarSelectDestinatarios();
    
    document.getElementById('mensagemForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const destino = document.getElementById('mensagemDestino').value;
        const assunto = document.getElementById('mensagemAssunto').value.trim();
        const conteudo = document.getElementById('mensagemConteudo').value.trim();
        
        if (!assunto || !conteudo) {
            showToast('Preencha assunto e conteúdo!', 'warning');
            return;
        }
        
        try {
            const body = { assunto, conteudo };
            
            if (destino === 'turma' && turmaAtual) {
                body.turma_id = turmaAtual.id;
                
            } else if (destino === 'pai_especifico') {
                const paiId = document.getElementById('paiSelect').value;
                if (!paiId) {
                    showToast('Selecione um pai!', 'warning');
                    return;
                }
                body.destinatario_id = parseInt(paiId);
                
            } else if (destino === 'aluno_especifico') {
                const alunoId = document.getElementById('alunoSelect').value;
                if (!alunoId) {
                    showToast('Selecione um aluno!', 'warning');
                    return;
                }
                body.destinatario_id = parseInt(alunoId);
                
            } else if (destino === 'todos_pais' || destino === 'todos_alunos' || destino === 'pais_alunos') {
                const destinatarios = await obterDestinatariosMultiplos(destino);
                
                if (destinatarios.length === 0) {
                    showToast('Nenhum destinatário encontrado!', 'warning');
                    return;
                }
                
                for (const dest of destinatarios) {
                    await fetch('/api/mensagens', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            ...body,
                            destinatario_id: dest.id
                        })
                    });
                }
                
                showToast(`✅ Mensagem enviada para ${destinatarios.length} destinatários!`, 'success');
                e.target.reset();
                document.getElementById('paiEspecificoGroup').style.display = 'none';
                document.getElementById('alunoEspecificoGroup').style.display = 'none';
                await carregarMensagens();
                return;
            }
            
            const response = await fetch('/api/mensagens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.erro || 'Erro');
            
            showToast('✅ Mensagem enviada!', 'success');
            e.target.reset();
            document.getElementById('paiEspecificoGroup').style.display = 'none';
            document.getElementById('alunoEspecificoGroup').style.display = 'none';
            await carregarMensagens();
            
        } catch (error) {
            showToast('❌ ' + error.message, 'error');
        }
    });
}

console.log('🚀 Dashboard do Professor carregado!');