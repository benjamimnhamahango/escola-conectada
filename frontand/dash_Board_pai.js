// ========================================
// DASHBOARD-PAI.JS - API Real
// ========================================

let filhosData = [];
let filhoAtual = null;
let notificacoesData = [];

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAuth()) return;
    if (usuarioAtual.tipo !== 'pai') {
        showToast('Acesso não autorizado', 'error');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('paiNome').textContent = usuarioAtual.nome || 'Pai';
    
    // Configurar formulários
    configurarFormResponder();
    configurarFormNovaMensagem();
    
    // Fechar modais ao clicar fora
    document.getElementById('modalConversa')?.addEventListener('click', function (e) {
        if (e.target === this) fecharModalConversa();
    });
    document.getElementById('modalNovaMensagem')?.addEventListener('click', function (e) {
        if (e.target === this) fecharModalNovaMensagem();
    });
    
    await carregarFilhos();
});

// ===== CARREGAR FILHOS DO PAI =====
async function carregarFilhos() {
    try {
        const response = await fetch(`/api/pais-alunos/${usuarioAtual.id}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar filhos');
        
        filhosData = await response.json();
        
        if (filhosData.length === 0) {
            mostrarSemFilhos();
            return;
        }
        
        // Se tiver mais de um filho, mostrar selector
        if (filhosData.length > 1) {
            const selector = document.getElementById('filhoSelector');
            selector.style.display = 'flex';
            
            const select = document.getElementById('selectFilho');
            select.innerHTML = filhosData.map(f => 
                `<option value="${f.id}">${f.nome} - ${f.turma ? f.turma.nome : 'Sem turma'}</option>`
            ).join('');
            
            select.addEventListener('change', (e) => {
                const filhoId = parseInt(e.target.value);
                selecionarFilho(filhoId);
            });
        }
        
        // Selecionar o primeiro filho
        selecionarFilho(filhosData[0].id);
        
    } catch (error) {
        console.error('Erro ao carregar filhos:', error);
        showToast('Erro ao carregar dados', 'error');
        mostrarSemFilhos();
    }
}

// ===== SELECIONAR FILHO =====
async function selecionarFilho(filhoId) {
    filhoAtual = filhosData.find(f => f.id === filhoId);
    
    if (!filhoAtual) return;
    
    // Mostrar info do filho
    const filhoInfo = document.getElementById('filhoInfo');
    filhoInfo.style.display = 'flex';
    
    document.getElementById('filhoAvatar').textContent = filhoAtual.nome.charAt(0).toUpperCase();
    document.getElementById('filhoNome').textContent = filhoAtual.nome;
    document.getElementById('filhoTurma').textContent = filhoAtual.turma 
        ? `📚 ${filhoAtual.turma.nome} (${filhoAtual.turma.ano}º Ano - ${filhoAtual.turma.turno})`
        : '📚 Sem turma atribuída';
    
    // Carregar todos os dados do filho
    await Promise.all([
        carregarEstatisticas(filhoId),
        carregarNotas(filhoId),
        carregarPresencasSemana(filhoId),
        carregarTPCs(filhoId),
        carregarMensagens(),
        carregarHistoricoPresencas()
    ]);
}

// ===== CARREGAR ESTATÍSTICAS =====
async function carregarEstatisticas(filhoId) {
    try {
        const responsePres = await fetch(`/api/presencas/aluno/${filhoId}/estatisticas`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (responsePres.ok) {
            const stats = await responsePres.json();
            document.getElementById('presencasTotal').textContent = stats.percentual + '%';
            document.getElementById('faltasTotal').textContent = stats.faltas;
        }
        
        const responseMedia = await fetch(`/api/notas/media/${filhoId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (responseMedia.ok) {
            const data = await responseMedia.json();
            document.getElementById('mediaGeral').textContent = 
                data.media_geral !== null ? data.media_geral.toFixed(1) : '-';
        }
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// ===== CARREGAR NOTAS =====
async function carregarNotas(filhoId) {
    const container = document.getElementById('notasDisciplinas');
    
    try {
        const response = await fetch(`/api/notas/aluno/${filhoId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar notas');
        
        const notas = await response.json();
        
        if (notas.length === 0) {
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">📊</div>
                    <p>Sem notas lançadas</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = notas.map(nota => {
            const media = nota.media !== null ? nota.media.toFixed(1) : '-';
            const mediaClass = nota.media !== null 
                ? (nota.media >= 10 ? 'media-boa' : 'media-fraca') 
                : '';
            
            return `
                <div class="nota-item">
                    <div>
                        <div class="disciplina">📖 ${nota.disciplina_nome}</div>
                        <div style="font-size: 11px; color: var(--gray-400);">${nota.trimestre}º Trimestre</div>
                    </div>
                    <div class="notas-detalhe">
                        <span>ACS1: <strong>${nota.ACS1 !== null ? nota.ACS1 : '-'}</strong></span>
                        <span>ACS2: <strong>${nota.ACS2 !== null ? nota.ACS2 : '-'}</strong></span>
                        <span>AT: <strong>${nota.AT !== null ? nota.AT : '-'}</strong></span>
                    </div>
                    <div class="media ${mediaClass}">${media}</div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar notas:', error);
        container.innerHTML = `
            <div class="empty-msg">
                <div class="icon">⚠️</div>
                <p>Erro ao carregar notas</p>
            </div>
        `;
    }
}

// ===== CARREGAR PRESENÇAS DA SEMANA =====
async function carregarPresencasSemana(filhoId) {
    const container = document.getElementById('chartPresencas');
    
    try {
        const response = await fetch(`/api/presencas/aluno/${filhoId}/semana`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const presencas = await response.json();
        
        if (presencas.length === 0) {
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">📊</div>
                    <p>Sem presenças registadas</p>
                </div>
            `;
            return;
        }
        
        presencas.reverse();
        
        const maxHeight = 100;
        
        container.innerHTML = presencas.map(p => {
            const data = new Date(p.data);
            const dia = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.getDay()];
            const diaNum = data.getDate();
            const presente = p.presente === 1;
            const height = maxHeight;
            
            return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; min-width: 40px;">
                    <div style="height:${height}px; width:100%; background:${presente ? 'var(--success)' : 'var(--danger)'}; border-radius:4px 4px 0 0; transition:all 0.5s ease; position:relative; display:flex; align-items:center; justify-content:center; color: white; font-size: 20px;">
                        ${presente ? '✓' : '✗'}
                    </div>
                    <div style="font-size:11px; color:var(--gray-500); margin-top:4px; text-align: center;">
                        <div>${dia}</div>
                        <div>${diaNum}</div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar presenças:', error);
        container.innerHTML = `
            <div class="empty-msg">
                <div class="icon">⚠️</div>
                <p>Erro ao carregar presenças</p>
            </div>
        `;
    }
}

// ===== CARREGAR TPCs =====
async function carregarTPCs(filhoId) {
    const container = document.getElementById('tpcPendentesLista');
    
    try {
        const response = await fetch(`/api/tpc/aluno/${filhoId}/status`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const tpcs = await response.json();
        
        const pendentes = tpcs.filter(t => t.status !== 'entregue').length;
        document.getElementById('tpcPendentesPai').textContent = pendentes;
        
        if (tpcs.length === 0) {
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">📝</div>
                    <p>Sem TPCs atribuídos</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = tpcs.map(tpc => {
            const dataEntrega = new Date(tpc.data_entrega);
            const hoje = new Date();
            const diasRestantes = Math.ceil((dataEntrega - hoje) / (1000 * 60 * 60 * 24));
            
            let statusBadge = '';
            let statusCor = 'var(--warning)';
            let statusTexto = '';
            
            if (tpc.status === 'entregue') {
                statusBadge = '<span class="badge-entregue">✅ Entregue</span>';
                statusCor = 'var(--success)';
                statusTexto = '✅ Entregue';
            } else if (tpc.status === 'nao_entregue') {
                statusBadge = '<span class="badge-falta">❌ Não Entregue</span>';
                statusCor = 'var(--danger)';
                statusTexto = '❌ Não Entregue';
            } else if (tpc.status === 'atrasado' || diasRestantes < 0) {
                statusBadge = '<span class="badge-falta">⚠️ Atrasado</span>';
                statusCor = 'var(--danger)';
                statusTexto = '⚠️ Atrasado';
            } else if (diasRestantes === 0) {
                statusBadge = '<span class="badge-pendente">📌 Hoje</span>';
                statusCor = 'var(--secondary)';
                statusTexto = '📌 Entrega hoje!';
            } else if (diasRestantes <= 2) {
                statusBadge = '<span class="badge-pendente">⏳ Urgente</span>';
                statusCor = 'var(--warning)';
                statusTexto = `⏳ ${diasRestantes} dias`;
            } else {
                statusBadge = '<span class="badge-pendente">📅 Pendente</span>';
                statusCor = 'var(--success)';
                statusTexto = `📅 ${diasRestantes} dias`;
            }
            
            const notaHtml = tpc.nota !== null && tpc.nota !== undefined 
                ? `<div style="margin-top: 8px; padding: 6px 12px; background: var(--gray-100); border-radius: 6px; display: inline-block;">
                    <strong>📊 Nota:</strong> <span style="font-weight: 700; color: ${tpc.nota >= 10 ? 'var(--success)' : 'var(--danger)'};">${tpc.nota}/20</span>
                   </div>` 
                : '';
            
            const comentarioHtml = tpc.comentario 
                ? `<div style="margin-top: 6px; padding: 8px 12px; background: #fef3c7; border-left: 3px solid var(--warning); border-radius: 4px; font-size: 13px;">
                    💬 <strong>Professor:</strong> ${tpc.comentario}
                   </div>` 
                : '';
            
            return `
                <div class="tpc-pai" style="border-left-color: ${statusCor};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <div class="titulo">📝 ${tpc.titulo}</div>
                        ${statusBadge}
                    </div>
                    ${tpc.descricao ? `<div class="descricao">${tpc.descricao}</div>` : ''}
                    <div class="data">
                        📖 ${tpc.disciplina_nome} • 
                        👨‍🏫 ${tpc.professor_nome} • 
                        📅 Entrega: ${formatarData(tpc.data_entrega)}
                        <span style="color: ${statusCor}; font-weight: 600; margin-left: 8px;">${statusTexto}</span>
                    </div>
                    ${notaHtml}
                    ${comentarioHtml}
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao carregar TPCs:', error);
        container.innerHTML = `
            <div class="empty-msg">
                <div class="icon">⚠️</div>
                <p>Erro ao carregar TPCs</p>
            </div>
        `;
    }
}

// ===== CARREGAR MENSAGENS =====
async function carregarMensagens() {
    const container = document.getElementById('mensagensListaPai');
    
    try {
        const response = await fetch('/api/mensagens/recebidas', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const mensagens = await response.json();
        
        if (mensagens.length === 0) {
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">💬</div>
                    <p>Sem mensagens</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = mensagens.map(msg => `
            <div class="mensagem-pai ${msg.lida ? '' : 'unread'}" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 200px;">
                    <div class="remetente">📩 ${msg.remetente_nome} (${msg.remetente_tipo})</div>
                    <div class="assunto">${msg.assunto}</div>
                    <div class="conteudo">${msg.conteudo}</div>
                    <div class="data">${formatarDataHora(msg.data_envio)}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="abrirConversa(${msg.remetente_id}, '${msg.remetente_nome.replace(/'/g, "\\'")}', ${msg.id})">
                    💬 Responder
                </button>
            </div>
        `).join('');
        
        // Marcar mensagens como lidas
        for (const msg of mensagens.filter(m => !m.lida)) {
            await fetch(`/api/mensagens/${msg.id}/lida`, {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + token }
            });
        }
        
    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        container.innerHTML = `
            <div class="empty-msg">
                <div class="icon">⚠️</div>
                <p>Erro ao carregar mensagens</p>
            </div>
        `;
    }
}

// ===== ABRIR CONVERSA =====
async function abrirConversa(userId, userName, mensagemId) {
    const modal = document.getElementById('modalConversa');
    const titulo = document.getElementById('modalConversaTitulo');
    const container = document.getElementById('conversaMensagens');
    
    if (!modal) return;
    
    modal.classList.add('active');
    titulo.textContent = `💬 Conversa com ${userName}`;
    container.innerHTML = '<div class="empty-msg">A carregar...</div>';
    
    window.conversaUserId = userId;
    window.mensagemOriginalId = mensagemId;
    
    await carregarConversa(userId);
}

async function carregarConversa(userId) {
    const container = document.getElementById('conversaMensagens');
    
    try {
        const response = await fetch(`/api/mensagens/conversa/${userId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar conversa');
        
        const mensagens = await response.json();
        
        if (mensagens.length === 0) {
            container.innerHTML = '<div class="empty-msg">Sem mensagens nesta conversa</div>';
            return;
        }
        
        container.innerHTML = mensagens.map(msg => {
            const isMeu = msg.remetente_id === usuarioAtual.id;
            const cor = isMeu ? 'var(--primary)' : 'var(--secondary)';
            const align = isMeu ? 'flex-end' : 'flex-start';
            const bg = isMeu ? '#e0e7ff' : '#fef3c7';
            
            return `
                <div style="display: flex; flex-direction: column; align-items: ${align}; margin-bottom: 12px;">
                    <div style="max-width: 80%; padding: 10px 14px; background: ${bg}; border-radius: 12px; border-left: 3px solid ${cor};">
                        <div style="font-size: 12px; color: var(--gray-500); margin-bottom: 4px;">
                            ${isMeu ? '👤 Eu' : '📩 ' + msg.remetente_nome}
                        </div>
                        <div style="font-weight: 600; font-size: 13px; color: ${cor}; margin-bottom: 4px;">${msg.assunto}</div>
                        <div style="font-size: 14px;">${msg.conteudo}</div>
                        <div style="font-size: 11px; color: var(--gray-400); margin-top: 4px;">${formatarDataHora(msg.data_envio)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.scrollTop = container.scrollHeight;
        
    } catch (error) {
        console.error('Erro ao carregar conversa:', error);
        container.innerHTML = '<div class="empty-msg">Erro ao carregar conversa</div>';
    }
}

function fecharModalConversa() {
    const modal = document.getElementById('modalConversa');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===== CONFIGURAR FORM DE RESPOSTA =====
function configurarFormResponder() {
    const form = document.getElementById('formResponder');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const conteudo = document.getElementById('respostaConteudo').value.trim();
        
        if (!conteudo) {
            showToast('Escreva uma mensagem!', 'warning');
            return;
        }
        
        if (!window.mensagemOriginalId) {
            showToast('Erro: mensagem original não identificada', 'error');
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
            
            document.getElementById('respostaConteudo').value = '';
            await carregarConversa(window.conversaUserId);
            await carregarMensagens();
            showToast('✅ Resposta enviada!', 'success');
            
        } catch (error) {
            showToast('❌ ' + error.message, 'error');
        }
    });
}

// ===== NOVA MENSAGEM =====
async function abrirModalNovaMensagem() {
    const modal = document.getElementById('modalNovaMensagem');
    if (!modal) return;
    
    modal.classList.add('active');
    
    const select = document.getElementById('novaMensagemDestino');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    try {
        const response = await fetch('/api/mensagens/utilizadores', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const utilizadores = await response.json();
        
        if (utilizadores.length === 0) {
            select.innerHTML = '<option value="">Nenhum professor disponível</option>';
        } else {
            select.innerHTML = '<option value="">Selecione um professor...</option>' +
                utilizadores.map(u => `<option value="${u.id}">${u.nome} (${u.tipo})</option>`).join('');
        }
        
    } catch (error) {
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

function fecharModalNovaMensagem() {
    const modal = document.getElementById('modalNovaMensagem');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===== CONFIGURAR FORM NOVA MENSAGEM =====
function configurarFormNovaMensagem() {
    const form = document.getElementById('formNovaMensagem');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const destinatario_id = document.getElementById('novaMensagemDestino').value;
        const assunto = document.getElementById('novaMensagemAssunto').value.trim();
        const conteudo = document.getElementById('novaMensagemConteudo').value.trim();
        
        if (!destinatario_id || !assunto || !conteudo) {
            showToast('Preencha todos os campos!', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/mensagens', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    destinatario_id: parseInt(destinatario_id),
                    assunto: assunto,
                    conteudo: conteudo
                })
            });
            
            if (!response.ok) throw new Error('Erro ao enviar');
            
            showToast('✅ Mensagem enviada!', 'success');
            form.reset();
            fecharModalNovaMensagem();
            await carregarMensagens();
            
        } catch (error) {
            showToast('❌ ' + error.message, 'error');
        }
    });
}

// ===== HISTÓRICO DE PRESENÇAS =====
async function carregarHistoricoPresencas() {
    if (!filhoAtual) {
        console.log('Sem filho selecionado');
        return;
    }
    
    const tbody = document.getElementById('historicoPresencasTable');
    if (!tbody) return;
    
    const disciplina = document.getElementById('filtroDisciplinaPresenca')?.value || '';
    const mes = document.getElementById('filtroMesPresenca')?.value || '';
    const ano = document.getElementById('filtroAnoPresenca')?.value || '';
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--gray-400);">A carregar...</td></tr>';
    
    try {
        let url = `/api/presencas/aluno/${filhoAtual.id}`;
        const params = [];
        
        if (mes && ano) {
            params.push(`mes=${mes}`);
            params.push(`ano=${ano}`);
        }
        
        if (params.length > 0) {
            url += '?' + params.join('&');
        }
        
        const response = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar presenças');
        
        let presencas = await response.json();
        
        if (disciplina) {
            presencas = presencas.filter(p => 
                p.disciplina_nome && p.disciplina_nome.toLowerCase().includes(disciplina.toLowerCase())
            );
        }
        
        renderizarHistoricoPresencas(presencas);
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--danger);">Erro ao carregar</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--gray-400);">Sem presenças registadas</td></tr>';
        return;
    }
    
    tbody.innerHTML = presencas.map(p => {
        const data = new Date(p.data);
        const dataFormatada = data.toLocaleDateString('pt-PT');
        
        return `
            <tr>
                <td>${dataFormatada}</td>
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

// ===== MOSTRAR SEM FILHOS =====
function mostrarSemFilhos() {
    const main = document.querySelector('main');
    
    document.getElementById('filhoInfo').style.display = 'none';
    document.getElementById('filhoSelector').style.display = 'none';
    
    const aviso = document.createElement('div');
    aviso.className = 'card';
    aviso.style.textAlign = 'center';
    aviso.style.padding = '40px';
    aviso.innerHTML = `
        <div style="font-size: 60px; margin-bottom: 16px;">👨‍👦</div>
        <h3 style="color: var(--gray-600); margin-bottom: 8px;">Nenhum filho associado</h3>
        <p style="color: var(--gray-400);">Contacte a administração da escola para associar o seu educando à sua conta.</p>
    `;
    
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) statsGrid.style.display = 'none';
    
    const grids = document.querySelectorAll('.grid');
    grids.forEach(g => g.style.display = 'none');
    
    document.querySelectorAll('.card').forEach(c => {
        if (c.querySelector('#tpcPendentesLista') || c.querySelector('#mensagensListaPai')) {
            c.style.display = 'none';
        }
    });
    
    main.appendChild(aviso);
}

console.log('🚀 Dashboard do Pai carregado!');