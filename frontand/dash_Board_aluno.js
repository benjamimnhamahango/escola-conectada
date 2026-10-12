// ========================================
// DASHBOARD-ALUNO.JS - API Real
// ========================================

let alunoData = null;
let notasData = [];
let presencasData = [];

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!verificarAuth()) return;
    if (usuarioAtual.tipo !== 'aluno') {
        showToast('Acesso não autorizado', 'error');
        window.location.href = 'index.html';
        return;
    }

    document.getElementById('alunoNome').textContent = usuarioAtual.nome || 'Aluno';
    
    await carregarDadosAluno();
});

// ===== CARREGAR TODOS OS DADOS =====
async function carregarDadosAluno() {
    try {
        const alunoId = usuarioAtual.id;
        
        // Info do aluno
        document.getElementById('alunoAvatar').textContent = usuarioAtual.nome.charAt(0).toUpperCase();
        document.getElementById('infoNome').textContent = usuarioAtual.nome;
        
        // Buscar turma do aluno
        await carregarInfoTurma(alunoId);
        
        // Carregar em paralelo
        await Promise.all([
            carregarEstatisticas(alunoId),
            carregarNotas(alunoId),
            carregarPresencas(alunoId),
            carregarTPCs(alunoId),
            carregarMensagens()
        ]);
        
        // Carregar histórico de presenças
        await carregarHistoricoPresencas();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showToast('Erro ao carregar dados', 'error');
    }
}

// ===== INFO DA TURMA =====
async function carregarInfoTurma(alunoId) {
    try {
        const responseTurmas = await fetch('/api/turmas', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!responseTurmas.ok) throw new Error('Erro ao buscar turmas');
        
        const turmas = await responseTurmas.json();
        
        for (const turma of turmas) {
            const responseAlunos = await fetch(`/api/turmas/${turma.id}/alunos`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            
            if (responseAlunos.ok) {
                const alunos = await responseAlunos.json();
                const encontrado = alunos.find(a => a.id === alunoId);
                
                if (encontrado) {
                    document.getElementById('infoTurma').textContent = 
                        `📚 ${turma.nome} (${turma.ano}º Ano - ${turma.turno})`;
                    return;
                }
            }
        }
        
        document.getElementById('infoTurma').textContent = '📚 Sem turma atribuída';
        
    } catch (error) {
        console.error('Erro ao carregar info turma:', error);
        document.getElementById('infoTurma').textContent = '📚 -';
    }
}

// ===== ESTATÍSTICAS =====
async function carregarEstatisticas(alunoId) {
    try {
        const responsePres = await fetch(`/api/presencas/aluno/${alunoId}/estatisticas`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (responsePres.ok) {
            const stats = await responsePres.json();
            document.getElementById('presencasTotal').textContent = stats.percentual + '%';
            document.getElementById('faltasTotal').textContent = stats.faltas;
        }
        
        const responseMedia = await fetch(`/api/notas/media/${alunoId}`, {
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

// ===== NOTAS =====
async function carregarNotas(alunoId) {
    const container = document.getElementById('notasDisciplinas');
    
    try {
        const response = await fetch(`/api/notas/aluno/${alunoId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro ao carregar notas');
        
        notasData = await response.json();
        
        if (notasData.length === 0) {
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">📊</div>
                    <p>Ainda não há notas lançadas</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = notasData.map(nota => {
            const media = nota.media !== null ? nota.media.toFixed(1) : '-';
            const mediaClass = nota.media !== null 
                ? (nota.media >= 10 ? 'media-boa' : 'media-fraca') 
                : '';
            
            return `
                <div class="nota-item">
                    <div>
                        <div class="disciplina">📖 ${nota.disciplina_nome}</div>
                        <div class="trimestre">${nota.trimestre}º Trimestre</div>
                    </div>
                    <div class="notas-detalhe">
                        <span>ACS1: ${nota.ACS1 !== null ? nota.ACS1 : '-'}</span>
                        <span>ACS2: ${nota.ACS2 !== null ? nota.ACS2 : '-'}</span>
                        <span>AT: ${nota.AT !== null ? nota.AT : '-'}</span>
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

// ===== PRESENÇAS =====
async function carregarPresencas(alunoId) {
    const container = document.getElementById('presencasLista');
    
    try {
        const response = await fetch(`/api/presencas/aluno/${alunoId}`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        presencasData = await response.json();
        
        if (presencasData.length === 0) {
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">📅</div>
                    <p>Sem presenças registadas</p>
                </div>
            `;
            return;
        }
        
        const recentes = presencasData.slice(0, 10);
        
        container.innerHTML = recentes.map(p => `
            <div class="presenca-item">
                <div>
                    <div class="data">📅 ${formatarData(p.data)}</div>
                    <div style="font-size: 12px; color: var(--gray-400);">
                        ${p.disciplina_nome || 'Geral'} ${p.turma_nome ? '• ' + p.turma_nome : ''}
                    </div>
                </div>
                <span class="${p.presente === 1 ? 'badge-presente' : 'badge-falta'}">
                    ${p.presente === 1 ? '✅ Presente' : '❌ Falta'}
                </span>
            </div>
        `).join('');
        
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

// ===== TPCs =====
async function carregarTPCs(alunoId) {
    const container = document.getElementById('tpcLista');
    
    try {
        const response = await fetch(`/api/tpc/aluno/${alunoId}/status`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const tpcs = await response.json();
        
        const pendentes = tpcs.filter(t => t.status !== 'entregue').length;
        document.getElementById('tpcTotal').textContent = pendentes;
        
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
                <div class="tpc-aluno" style="border-left-color: ${statusCor};">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <div class="titulo">📝 ${tpc.titulo}</div>
                        ${statusBadge}
                    </div>
                    ${tpc.descricao ? `<div class="descricao">${tpc.descricao}</div>` : ''}
                    <div class="meta">
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

// ===== MENSAGENS (RECEBIDAS + ENVIADAS) =====
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
            container.innerHTML = `
                <div class="empty-msg">
                    <div class="icon">💬</div>
                    <p>Sem mensagens</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        if (recebidas.length > 0) {
            html += '<h4 style="margin-bottom: 12px; color: var(--primary);">📥 Mensagens Recebidas</h4>';
            html += recebidas.map(msg => `
                <div class="mensagem-aluno ${msg.lida ? '' : 'unread'}" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 200px;">
                        <div class="remetente">📩 ${msg.remetente_nome} (${msg.remetente_tipo})</div>
                        <div class="assunto">${msg.assunto}</div>
                        <div class="conteudo">${msg.conteudo}</div>
                        <div class="data">${formatarDataHora(msg.data_envio)}</div>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="abrirConversaAluno(${msg.remetente_id}, '${msg.remetente_nome.replace(/'/g, "\\'")}', ${msg.id})">
                        💬 Responder
                    </button>
                </div>
            `).join('');
        }
        
        if (enviadas.length > 0) {
            html += '<h4 style="margin: 24px 0 12px 0; color: var(--secondary);">📤 Mensagens Enviadas</h4>';
            html += enviadas.map(msg => `
                <div class="mensagem-aluno" style="border-left-color: var(--secondary);">
                    <div class="remetente">📤 Para: ${msg.destinatario_nome || msg.turma_nome || 'Professor'}</div>
                    <div class="assunto">${msg.assunto}</div>
                    <div class="conteudo">${msg.conteudo}</div>
                    <div class="data">${formatarDataHora(msg.data_envio)}</div>
                </div>
            `).join('');
        }
        
        container.innerHTML = html;
        
        for (const msg of recebidas.filter(m => !m.lida)) {
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

// ========================================
// MENSAGENS AVANÇADAS — ALUNO
// ========================================

// ===== MODAL DE CONVERSA =====
async function abrirConversaAluno(userId, userName, mensagemId) {
    let modal = document.getElementById('modalConversaAluno');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalConversaAluno';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9;">
                    <h3 id="modalConversaAlunoTitulo" style="margin: 0;">💬 Conversa com ${userName}</h3>
                    <button onclick="fecharModalConversaAluno()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #94a3b8;">&times;</button>
                </div>
                <div id="conversaAlunoMensagens" style="max-height: 400px; overflow-y: auto; margin-bottom: 20px; padding: 8px 0;">
                    <div style="text-align: center; padding: 30px; color: #94a3b8;">A carregar...</div>
                </div>
                <form id="formResponderAluno" style="display: flex; gap: 8px;">
                    <textarea id="respostaAlunoConteudo" placeholder="Escreva sua resposta..." style="flex: 1; min-height: 60px; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-family: 'Poppins', sans-serif; resize: vertical;" required></textarea>
                    <button type="submit" class="btn btn-primary" style="align-self: flex-end;">📤 Enviar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('formResponderAluno').addEventListener('submit', async (e) => {
            e.preventDefault();
            await enviarRespostaAluno();
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) fecharModalConversaAluno();
        });
    } else {
        document.getElementById('modalConversaAlunoTitulo').textContent = `💬 Conversa com ${userName}`;
        modal.style.display = 'flex';
    }
    
    window.conversaAlunoUserId = userId;
    window.mensagemAlunoOriginalId = mensagemId;
    await carregarConversaAluno(userId);
}

async function carregarConversaAluno(userId) {
    const container = document.getElementById('conversaAlunoMensagens');
    
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

function fecharModalConversaAluno() {
    const modal = document.getElementById('modalConversaAluno');
    if (modal) modal.style.display = 'none';
}

async function enviarRespostaAluno() {
    const conteudo = document.getElementById('respostaAlunoConteudo').value.trim();
    
    if (!conteudo || !window.mensagemAlunoOriginalId) {
        showToast('Escreva uma mensagem!', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/mensagens/responder/${window.mensagemAlunoOriginalId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ conteudo })
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.erro || 'Erro ao enviar');
        
        document.getElementById('respostaAlunoConteudo').value = '';
        await carregarConversaAluno(window.conversaAlunoUserId);
        await carregarMensagens();
        showToast('✅ Resposta enviada!', 'success');
        
    } catch (error) {
        showToast('❌ ' + error.message, 'error');
    }
}

// ===== NOVA MENSAGEM =====
async function abrirModalNovaMensagem() {
    let modal = document.getElementById('modalNovaMensagem');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalNovaMensagem';
        modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 32px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9;">
                    <h3 style="margin: 0;">✉️ Nova Mensagem</h3>
                    <button onclick="fecharModalNovaMensagem()" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #94a3b8;">&times;</button>
                </div>
                <form id="formNovaMensagemAluno" style="display: flex; flex-direction: column; gap: 16px;">
                    <div>
                        <label style="display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #334155;">👨‍🏫 Destinatário</label>
                        <select id="novaMsgProfessor" required style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-family: 'Poppins', sans-serif;">
                            <option value="">A carregar professores...</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #334155;">📋 Assunto</label>
                        <input type="text" id="novaMsgAssunto" placeholder="Ex: Dúvida sobre o TPC" required style="width: 100%; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-family: 'Poppins', sans-serif;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #334155;">💬 Mensagem</label>
                        <textarea id="novaMsgConteudo" placeholder="Escreva a sua mensagem..." required style="width: 100%; min-height: 120px; padding: 10px; border: 2px solid #e2e8f0; border-radius: 8px; font-family: 'Poppins', sans-serif; resize: vertical;"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="align-self: flex-end;">📤 Enviar Mensagem</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('formNovaMensagemAluno').addEventListener('submit', async (e) => {
            e.preventDefault();
            await enviarNovaMensagemAluno();
        });
        
        modal.addEventListener('click', function(e) {
            if (e.target === this) fecharModalNovaMensagem();
        });
        
        await carregarProfessoresAluno();
    } else {
        modal.style.display = 'flex';
        await carregarProfessoresAluno();
    }
}

async function carregarProfessoresAluno() {
    const select = document.getElementById('novaMsgProfessor');
    if (!select) return;
    
    try {
        const response = await fetch('/api/aluno/professores', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        
        if (!response.ok) throw new Error('Erro');
        
        const professores = await response.json();
        
        if (professores.length === 0) {
            select.innerHTML = '<option value="">Sem professores atribuídos à sua turma</option>';
            return;
        }
        
        select.innerHTML = '<option value="">Selecione um professor...</option>' +
            professores.map(p => `<option value="${p.id}">${p.nome} — ${p.disciplina_nome}</option>`).join('');
        
    } catch (error) {
        console.error('Erro ao carregar professores:', error);
        select.innerHTML = '<option value="">Erro ao carregar professores</option>';
    }
}

async function enviarNovaMensagemAluno() {
    const destinatarioId = document.getElementById('novaMsgProfessor').value;
    const assunto = document.getElementById('novaMsgAssunto').value.trim();
    const conteudo = document.getElementById('novaMsgConteudo').value.trim();
    
    if (!destinatarioId || !assunto || !conteudo) {
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
                destinatario_id: parseInt(destinatarioId),
                assunto,
                conteudo
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) throw new Error(result.erro || 'Erro ao enviar');
        
        showToast('✅ Mensagem enviada!', 'success');
        fecharModalNovaMensagem();
        await carregarMensagens();
        
    } catch (error) {
        showToast('❌ ' + error.message, 'error');
    }
}

function fecharModalNovaMensagem() {
    const modal = document.getElementById('modalNovaMensagem');
    if (modal) modal.style.display = 'none';
    
    const form = document.getElementById('formNovaMensagemAluno');
    if (form) form.reset();
}

// ===== HISTÓRICO DE PRESENÇAS =====
async function carregarHistoricoPresencas() {
    const alunoId = usuarioAtual.id;
    const tbody = document.getElementById('historicoPresencasTable');
    
    if (!tbody) return;
    
    const disciplina = document.getElementById('filtroDisciplinaPresenca')?.value || '';
    const mes = document.getElementById('filtroMesPresenca')?.value || '';
    const ano = document.getElementById('filtroAnoPresenca')?.value || '';
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="color: var(--gray-400);">A carregar...</td></tr>';
    
    try {
        let url = `/api/presencas/aluno/${alunoId}`;
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

console.log('🚀 Dashboard do Aluno carregado!');