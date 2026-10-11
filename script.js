// ==========================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ==========================================
const supabaseUrl = 'https://zdjdfiblmlbjmvnkwdma.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkamRmaWJsbWxiam12bmt3ZG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1OTAzNzksImV4cCI6MjEwNzE2NjM3OX0.8xBUL-ucmszY3riejEMlPfE_qiTnWoWKjpan4GDhRLs';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

let clienteAtual = null; 
let carrinho = [];
let estoqueLocal = [];
let vendasGlobais = []; 
let produtosPesquisaCache = []; 
let carrinhoEdit = [];
let carrinhoOriginalEdit = [];
let valorJaPagoEdit = 0;
let variacoesOriginaisEdit = []; 

// ==========================================
// 2. MÓDULO DE VENDAS E CLIENTES
// ==========================================
document.getElementById('data_compra').valueAsDate = new Date();
let dataVenc = new Date(); dataVenc.setDate(dataVenc.getDate() + 30);
document.getElementById('data_vencimento').valueAsDate = dataVenc;

async function buscarCliente() {
    const cpfInput = document.getElementById('cpf').value; 
    if (!cpfInput || cpfInput.length < 14) return alert("Digite um CPF completo para buscar (Ex: 000.000.000-00).");
    const btnBusca = document.querySelector('button[onclick="buscarCliente()"]');
    const textoOriginal = btnBusca.innerText; btnBusca.innerText = "A buscar..."; btnBusca.disabled = true;
    const { data } = await supabaseClient.from('clientes').select('*').eq('cpf', cpfInput).single();
    btnBusca.innerText = textoOriginal; btnBusca.disabled = false;

    if (data) {
        clienteAtual = data.id;
        document.getElementById('nome').value = data.nome || '';
        document.getElementById('rg').value = data.rg || '';
        document.getElementById('data_nasc').value = data.data_nascimento || '';
        if (data.endereco) {
            document.getElementById('logradouro').value = data.endereco.logradouro || ''; document.getElementById('numero').value = data.endereco.numero || '';
            document.getElementById('bairro').value = data.endereco.bairro || ''; document.getElementById('complemento').value = data.endereco.complemento || '';
            document.getElementById('referencia').value = data.endereco.referencia || '';
        }
        if (data.telefones && Array.isArray(data.telefones)) {
            const container = document.getElementById('telefones_container'); container.innerHTML = '<label class="block text-xs sm:text-sm font-medium text-slate-700">Telefones</label>'; qtdTelefonesLayout = 0; 
            data.telefones.forEach((tel, index) => {
                const div = document.createElement('div'); div.className = "flex gap-2 mt-1 mb-2";
                if (index === 0) div.innerHTML = `<input type="tel" name="telefone[]" value="${tel}" class="w-full rounded border p-2.5 sm:p-2"><button type="button" onclick="adicionarTelefone()" class="bg-green-100 text-green-700 px-4 rounded font-bold text-lg">+</button>`;
                else div.innerHTML = `<input type="tel" name="telefone[]" value="${tel}" class="w-full rounded border p-2.5 sm:p-2"><button type="button" onclick="this.parentElement.remove(); qtdTelefonesLayout--;" class="bg-red-100 text-red-700 px-4 rounded font-bold text-lg">&times;</button>`;
                container.appendChild(div); qtdTelefonesLayout++;
            });
        }
    } else {
        clienteAtual = null; alert("Cliente não encontrado. Preencha os dados para novo cadastro.");
    }
}

function mostrarDropdownProdutos() { document.getElementById('dropdown_produtos').classList.remove('hidden'); filtrarDropdownProdutos(); }
document.addEventListener('click', function(event) {
    const input = document.getElementById('busca_produto'), dropdown = document.getElementById('dropdown_produtos');
    if (input && dropdown && event.target !== input && !dropdown.contains(event.target)) dropdown.classList.add('hidden');
    const inputEdit = document.getElementById('edit_busca_produto'), dropdownEdit = document.getElementById('dropdown_edit_produtos');
    if (inputEdit && dropdownEdit && event.target !== inputEdit && !dropdownEdit.contains(event.target)) dropdownEdit.classList.add('hidden');
});

function filtrarDropdownProdutos() {
    const termo = document.getElementById('busca_produto').value.toLowerCase();
    const dropdown = document.getElementById('dropdown_produtos'); dropdown.innerHTML = '';
    const filtrados = produtosPesquisaCache.filter(p => p.nome_completo.toLowerCase().includes(termo)).slice(0, 50); 
    if (filtrados.length === 0) return dropdown.innerHTML = `<div class="p-3 text-slate-500 text-sm">Sem estoque.</div>`;
    filtrados.forEach(prod => {
        const div = document.createElement('div'); div.className = "p-3 border-b cursor-pointer hover:bg-blue-50";
        div.innerHTML = `<div class="flex justify-between items-center"><span class="font-medium text-slate-700 text-sm">${prod.nome_completo}</span><span class="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Qtd: ${prod.estoque}</span></div><div class="text-blue-600 text-xs font-bold mt-1">R$ ${prod.preco.toFixed(2).replace('.', ',')}</div>`;
        div.onclick = () => { document.getElementById('busca_produto').value = prod.nome_completo; document.getElementById('produto_selecionado_id').value = prod.id; document.getElementById('produto_selecionado_nome').value = prod.nome_completo; document.getElementById('valor_produto').value = prod.preco; dropdown.classList.add('hidden'); };
        dropdown.appendChild(div);
    });
}

function adicionarProduto() {
    const id = document.getElementById('produto_selecionado_id').value, nome = document.getElementById('produto_selecionado_nome').value;
    let valor = document.getElementById('valor_produto').value.replace(',', '.'); const vInfo = parseFloat(valor);
    if (!id) return alert("Pesquise e CLIQUE num produto da lista suspensa."); if (isNaN(vInfo) || vInfo < 0) return alert("Valor inválido.");
    carrinho.push({ variacao_id: id, nome: nome, valor: vInfo, qtd: 1 }); atualizarTabela();
    document.getElementById('busca_produto').value = ""; document.getElementById('produto_selecionado_id').value = ""; document.getElementById('produto_selecionado_nome').value = ""; document.getElementById('valor_produto').value = "";
}
function removerProduto(i) { carrinho.splice(i, 1); atualizarTabela(); }
function atualizarTabela() {
    const tbody = document.getElementById('tabela_carrinho'); tbody.innerHTML = ""; let total = 0;
    if (carrinho.length === 0) { tbody.innerHTML = `<tr><td colspan="3" class="px-3 py-4 text-center text-slate-500 text-sm">Vazio.</td></tr>`; } 
    else { carrinho.forEach((item, i) => { total += item.valor; tbody.innerHTML += `<tr><td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap truncate max-w-[150px] sm:max-w-xs">${item.nome}</td><td class="px-3 py-2 text-right text-xs sm:text-sm whitespace-nowrap">R$ ${item.valor.toFixed(2).replace('.', ',')}</td><td class="px-3 py-2 text-center"><button onclick="removerProduto(${i})" class="text-red-500 font-bold px-3 py-1 text-base">&times;</button></td></tr>`; }); }
    document.getElementById('total_pedido').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

async function finalizarPedido() {
    if (carrinho.length === 0) return alert("Adicione produtos!");
    const cpf = document.getElementById('cpf').value; if (!cpf || cpf.length < 14) return alert("CPF incompleto.");
    let idDoCliente = clienteAtual;
    if (!idDoCliente) {
        const endereco = { logradouro: document.getElementById('logradouro').value, numero: document.getElementById('numero').value, bairro: document.getElementById('bairro').value, complemento: document.getElementById('complemento').value, referencia: document.getElementById('referencia').value };
        const fones = Array.from(document.querySelectorAll('input[name="telefone[]"]')).map(i => i.value).filter(v => v.trim() !== '');
        const { data: nCli, error: eCli } = await supabaseClient.from('clientes').insert([{ cpf: cpf, nome: document.getElementById('nome').value, rg: document.getElementById('rg').value, data_nascimento: document.getElementById('data_nasc').value || null, endereco: endereco, telefones: fones }]).select();
        if (eCli) return alert("Erro Cliente: " + eCli.message); idDoCliente = nCli[0].id;
    }
    const qtdParc = parseInt(document.getElementById('qtd_parcelas').value) || 1, tx = parseFloat(document.getElementById('taxa_juros').value) || 0, car = parseInt(document.getElementById('dias_carencia').value) || 0;
    const { data: ped, error: ePed } = await supabaseClient.from('pedidos').insert([{ cliente_id: idDoCliente, cidade_venda: document.getElementById('cidade').value, data_compra: document.getElementById('data_compra').value, quantidade_parcelas: qtdParc, taxa_juros_mensal: tx, dias_carencia_juros: car }]).select();
    if (ePed) return alert("Erro Pedido: " + ePed.message);
    let vTot = 0; const itensIns = carrinho.map(i => { vTot += i.valor; return { pedido_id: ped[0].id, variacao_id: i.variacao_id, quantidade: 1, valor_aplicado: i.valor } });
    await supabaseClient.from('itens_pedido').insert(itensIns);
    let dVenc = new Date(document.getElementById('data_vencimento').value + 'T00:00:00'); const vBase = parseFloat((vTot / qtdParc).toFixed(2)); const parcIns = [];
    for (let i = 1; i <= qtdParc; i++) {
        let vDesta = (i === qtdParc) ? (vTot - (vBase * (qtdParc - 1))) : vBase;
        parcIns.push({ pedido_id: ped[0].id, numero_parcela: i, valor_parcela: vDesta, data_vencimento: dVenc.toISOString().split('T')[0], status_pagamento: 'pendente' });
        dVenc.setMonth(dVenc.getMonth() + 1);
    }
    await supabaseClient.from('parcelas_pedido').insert(parcIns);
    for (let i of carrinho) { const { data: vD } = await supabaseClient.from('produto_variacoes').select('quantidade_estoque').eq('id', i.variacao_id).single(); if(vD && vD.quantidade_estoque > 0) await supabaseClient.from('produto_variacoes').update({ quantidade_estoque: vD.quantidade_estoque - 1 }).eq('id', i.variacao_id); }
    alert(`Venda gerada com sucesso!`); location.reload(); 
}

// ==========================================
// 3. MÓDULO FINANCEIRO
// ==========================================
async function carregarVendas() {
    const { data, error } = await supabaseClient.from('pedidos').select(`id, data_compra, cidade_venda, quantidade_parcelas, taxa_juros_mensal, dias_carencia_juros, cliente_id, clientes (id, nome, cpf), parcelas_pedido (id, numero_parcela, valor_parcela, data_vencimento, status_pagamento, data_pagamento), itens_pedido (id, variacao_id, valor_aplicado, quantidade, produto_variacoes (detalhe, produtos (nome, marca)))`).order('data_compra', { ascending: false });
    if (error) return console.error(error); vendasGlobais = data || []; renderizarVendas(vendasGlobais);
}

function renderizarVendas(dados) {
    const container = document.getElementById('lista_vendas'); container.innerHTML = ''; const hoje = new Date(); const hjNorm = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); let cAtras = 0, cProx = 0, vRec = 0;
    if (!dados || dados.length === 0) { container.innerHTML = `<div class="text-center p-5 bg-white text-slate-500 text-sm border rounded">Vazio.</div>`; document.getElementById('total_resultados').innerText = "0"; return; }
    dados.forEach(v => {
        let htmlP = ''; let vTot = 0; let pList = v.parcelas_pedido || []; pList.sort((a, b) => a.numero_parcela - b.numero_parcela);
        pList.forEach(p => {
            vTot += p.valor_parcela; const dVObj = new Date(p.data_vencimento + 'T00:00:00'); const dVNorm = new Date(dVObj.getFullYear(), dVObj.getMonth(), dVObj.getDate()); const dDias = Math.floor((dVNorm - hjNorm) / 86400000);
            let sVis = "", aBtn = "", vEx = p.valor_parcela;
            if (p.status_pagamento === "pago") {
                sVis = `<span class="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold">PAGO</span>`; aBtn = `<span class="text-xs text-emerald-600 font-bold px-2"><i class="fa-solid fa-check"></i></span>`;
                const dPg = new Date((p.data_pagamento ? p.data_pagamento : p.data_vencimento) + 'T00:00:00'); if (dPg.getMonth() === hoje.getMonth() && dPg.getFullYear() === hoje.getFullYear()) vRec += p.valor_parcela;
            } else if (dDias < 0) {
                const dAt = Math.abs(dDias); cAtras++; let eJ = "";
                if (dAt > v.dias_carencia_juros && v.taxa_juros_mensal > 0) { const jA = p.valor_parcela * ((v.taxa_juros_mensal / 100) / 30) * dAt; vEx += jA; eJ = `<span class="text-[8px] sm:text-[9px] text-red-500 block leading-tight">+R$ ${jA.toFixed(2).replace('.',',')} juros</span>`; }
                sVis = `<div class="flex flex-col items-center"><span class="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold">Atraso (${dAt}d)</span> ${eJ}</div>`; aBtn = `<button onclick="pagarParcela('${p.id}')" class="text-[10px] sm:text-xs bg-green-600 text-white px-3 py-1.5 sm:py-1 rounded font-bold">Pagar</button>`;
            } else {
                if (dDias <= 10) cProx++; sVis = `<span class="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold">Vence em ${dDias}d</span>`; aBtn = `<button onclick="pagarParcela('${p.id}')" class="text-[10px] sm:text-xs border border-green-600 text-green-600 px-3 py-1.5 sm:py-1 rounded font-bold">Pagar</button>`;
            }
            htmlP += `<div class="flex justify-between items-center py-2 sm:py-3 border-b last:border-0 gap-2"><div class="flex-1"><p class="text-[11px] sm:text-xs font-semibold">Parc. ${p.numero_parcela}</p><p class="text-[9px] sm:text-[10px] text-slate-500">${p.data_vencimento.split('-').reverse().join('/')}</p></div><div class="flex-1 flex flex-col items-center"><p class="text-[11px] sm:text-xs font-bold whitespace-nowrap">R$ ${vEx.toFixed(2).replace('.', ',')}</p>${sVis}</div><div class="flex-1 flex justify-end">${aBtn}</div></div>`;
        });
        const bExCli = (v.clientes?.id) ? `<button onclick="excluirCliente('${v.clientes.id}')" class="text-[9px] sm:text-[10px] bg-red-800 text-white px-2 py-1.5 sm:py-1 rounded"><i class="fa-solid fa-user-xmark"></i></button>` : '';
        container.innerHTML += `<div class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border mb-3"><div class="flex justify-between items-start mb-3 pb-2 border-b"><div><h3 class="font-bold text-xs sm:text-sm line-clamp-1">${v.clientes?.nome || 'Apagado'}</h3><p class="text-[9px] sm:text-[10px] text-slate-500">CPF: ${v.clientes?.cpf || 'N/A'} | Cmp: ${v.data_compra.split('-').reverse().join('/')}</p></div><div class="text-right flex flex-col items-end"><span class="font-bold text-blue-600 text-xs sm:text-sm block mb-1.5">Total: R$ ${vTot.toFixed(2).replace('.', ',')}</span><div class="flex gap-1"><button onclick="abrirModalEditarPedido('${v.id}')" class="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-1.5 sm:py-1 rounded"><i class="fa-solid fa-pen"></i></button><button onclick="abrirModalReajuste('${v.id}')" class="text-[10px] bg-amber-100 text-amber-700 px-2.5 py-1.5 sm:py-1 rounded"><i class="fa-regular fa-calendar-days"></i></button><button onclick="excluirVenda('${v.id}')" class="text-[10px] bg-red-100 text-red-700 px-2.5 py-1.5 sm:py-1 rounded"><i class="fa-solid fa-trash"></i></button>${bExCli}</div></div></div><div class="bg-slate-50 rounded p-2 sm:p-3">${htmlP}</div></div>`;
    });
    document.getElementById('total_resultados').innerText = dados.length; document.getElementById('count_atrasados').innerText = cAtras; document.getElementById('count_proximos').innerText = cProx; document.getElementById('valor_recebido').innerText = `R$ ${vRec.toFixed(2).replace('.', ',')}`;
}

async function excluirCliente(id) { if(confirm("Excluir Cliente e TODAS as vendas?")) { await supabaseClient.from('clientes').delete().eq('id', id); carregarVendas(); } }
async function pagarParcela(id) { if(confirm("Confirmar recebimento?")) { await supabaseClient.from('parcelas_pedido').update({ status_pagamento: 'pago', data_pagamento: new Date().toISOString().split('T')[0] }).eq('id', id); carregarVendas(); } }
async function excluirVenda(id) { if(confirm("Excluir apenas esta venda?")) { await supabaseClient.from('pedidos').delete().eq('id', id); carregarVendas(); } }

// EDIÇÃO DE PEDIDOS
function fecharModalEditar() { document.getElementById('modal_editar_pedido').classList.add('hidden'); }
function abrirModalEditarPedido(id) {
    const ped = vendasGlobais.find(p => p.id === id); if (!ped) return;
    document.getElementById('edit_pedido_id').value = ped.id; document.getElementById('edit_cidade').value = ped.cidade_venda; document.getElementById('edit_data_compra').value = ped.data_compra; document.getElementById('edit_taxa_juros').value = ped.taxa_juros_mensal; document.getElementById('edit_dias_carencia').value = ped.dias_carencia_juros;
    valorJaPagoEdit = 0; let pend = 0;
    if (ped.parcelas_pedido) { ped.parcelas_pedido.forEach(p => { if (p.status_pagamento === 'pago') valorJaPagoEdit += p.valor_parcela; if (p.status_pagamento === 'pendente') pend++; }); }
    document.getElementById('edit_qtd_parcelas').value = pend > 0 ? pend : 1; let pV = new Date(); pV.setMonth(pV.getMonth() + 1); document.getElementById('edit_data_vencimento').valueAsDate = pV;
    carrinhoEdit = []; carrinhoOriginalEdit = [];
    if (ped.itens_pedido) { ped.itens_pedido.forEach(i => { const nS = `${i.produto_variacoes.produtos.nome} - ${i.produto_variacoes.detalhe}`; const o = { variacao_id: i.variacao_id, nome: nS, valor: i.valor_aplicado, qtd: i.quantidade }; carrinhoEdit.push({...o}); carrinhoOriginalEdit.push({...o}); }); }
    atualizarTabelaEdit(); document.getElementById('modal_editar_pedido').classList.remove('hidden');
}
function mostrarDropdownEdit() { document.getElementById('dropdown_edit_produtos').classList.remove('hidden'); filtrarDropdownEdit(); }
function filtrarDropdownEdit() {
    const t = document.getElementById('edit_busca_produto').value.toLowerCase(), d = document.getElementById('dropdown_edit_produtos'); d.innerHTML = ''; const f = produtosPesquisaCache.filter(p => p.nome_completo.toLowerCase().includes(t)).slice(0, 30); 
    if (f.length === 0) return d.innerHTML = `<div class="p-2 text-slate-500 text-sm">Sem estoque.</div>`;
    f.forEach(p => { const v = document.createElement('div'); v.className = "p-2 border-b cursor-pointer hover:bg-blue-50"; v.innerHTML = `<div class="flex justify-between text-xs sm:text-sm"><span>${p.nome_completo}</span><span class="text-[10px]">Qtd: ${p.estoque}</span></div><div class="text-blue-600 text-[11px] font-bold">R$ ${p.preco.toFixed(2).replace('.', ',')}</div>`;
        v.onclick = () => { document.getElementById('edit_busca_produto').value = p.nome_completo; document.getElementById('edit_produto_id').value = p.id; document.getElementById('edit_produto_nome').value = p.nome_completo; document.getElementById('edit_valor_produto').value = p.preco; d.classList.add('hidden'); }; d.appendChild(v); });
}
function adicionarProdutoEdit() {
    const id = document.getElementById('edit_produto_id').value, nm = document.getElementById('edit_produto_nome').value; let vIn = document.getElementById('edit_valor_produto').value.replace(',', '.'); const v = parseFloat(vIn);
    if (!id || isNaN(v)) return alert("Inválido."); carrinhoEdit.push({ variacao_id: id, nome: nm, valor: v, qtd: 1 }); atualizarTabelaEdit();
    document.getElementById('edit_busca_produto').value = ""; document.getElementById('edit_produto_id').value = ""; document.getElementById('edit_produto_nome').value = ""; document.getElementById('edit_valor_produto').value = "";
}
function removerProdutoEdit(i) { carrinhoEdit.splice(i, 1); atualizarTabelaEdit(); }
function atualizarTabelaEdit() {
    const tbody = document.getElementById('tabela_edit_carrinho'); tbody.innerHTML = ""; let nT = 0;
    carrinhoEdit.forEach((i, idx) => { nT += i.valor; tbody.innerHTML += `<tr><td class="px-2 py-2 truncate max-w-[120px]">${i.nome}</td><td class="px-2 py-2 text-right whitespace-nowrap">R$ ${i.valor.toFixed(2).replace('.', ',')}</td><td class="px-2 py-2 text-center"><button onclick="removerProdutoEdit(${idx})" class="text-red-500 font-bold px-2 text-lg">&times;</button></td></tr>`; });
    const sD = nT - valorJaPagoEdit; document.getElementById('edit_resumo_total').innerText = `R$ ${nT.toFixed(2).replace('.', ',')}`; document.getElementById('edit_resumo_pago').innerText = `R$ ${valorJaPagoEdit.toFixed(2).replace('.', ',')}`;
    const av = document.getElementById('aviso_saldo_negativo'), bs = document.getElementById('btn_salvar_edicao');
    if (sD < 0) { document.getElementById('edit_resumo_saldo').innerText = `CRÉDITO R$ ${Math.abs(sD).toFixed(2).replace('.', ',')}`; av.classList.remove('hidden'); bs.disabled = true; bs.classList.add('opacity-50'); } else { document.getElementById('edit_resumo_saldo').innerText = `R$ ${sD.toFixed(2).replace('.', ',')}`; av.classList.add('hidden'); bs.disabled = false; bs.classList.remove('opacity-50'); }
}
async function salvarEdicaoPedido() {
    const bs = document.getElementById('btn_salvar_edicao'); bs.innerText = "A guardar..."; bs.disabled = true;
    const idP = document.getElementById('edit_pedido_id').value; let nT = carrinhoEdit.reduce((a, i) => a + i.valor, 0); let sD = nT - valorJaPagoEdit;
    await supabaseClient.from('pedidos').update({ cidade_venda: document.getElementById('edit_cidade').value, data_compra: document.getElementById('edit_data_compra').value, taxa_juros_mensal: parseFloat(document.getElementById('edit_taxa_juros').value) || 0, dias_carencia_juros: parseInt(document.getElementById('edit_dias_carencia').value) || 0, quantidade_parcelas: parseInt(document.getElementById('edit_qtd_parcelas').value) || 1 }).eq('id', idP);
    for (let i of carrinhoOriginalEdit) { const { data } = await supabaseClient.from('produto_variacoes').select('quantidade_estoque').eq('id', i.variacao_id).single(); if(data) await supabaseClient.from('produto_variacoes').update({ quantidade_estoque: data.quantidade_estoque + 1 }).eq('id', i.variacao_id); }
    for (let i of carrinhoEdit) { const { data } = await supabaseClient.from('produto_variacoes').select('quantidade_estoque').eq('id', i.variacao_id).single(); if(data) await supabaseClient.from('produto_variacoes').update({ quantidade_estoque: data.quantidade_estoque - 1 }).eq('id', i.variacao_id); }
    await supabaseClient.from('itens_pedido').delete().eq('pedido_id', idP); await supabaseClient.from('itens_pedido').insert(carrinhoEdit.map(i => ({ pedido_id: idP, variacao_id: i.variacao_id, quantidade: 1, valor_aplicado: i.valor })));
    await supabaseClient.from('parcelas_pedido').delete().eq('pedido_id', idP).eq('status_pagamento', 'pendente');
    if (sD > 0) {
        const qP = parseInt(document.getElementById('edit_qtd_parcelas').value) || 1; let dV = new Date(document.getElementById('edit_data_vencimento').value + 'T00:00:00'); const vB = parseFloat((sD / qP).toFixed(2)); const pI = [];
        const pD = vendasGlobais.find(p => p.id === idP); let nU = 0; if (pD && pD.parcelas_pedido) { pD.parcelas_pedido.forEach(p => { if(p.status_pagamento === 'pago' && p.numero_parcela > nU) nU = p.numero_parcela; }); }
        for (let i = 1; i <= qP; i++) { let vD = (i === qP) ? (sD - (vB * (qP - 1))) : vB; pI.push({ pedido_id: idP, numero_parcela: (nU + i), valor_parcela: vD, data_vencimento: dV.toISOString().split('T')[0], status_pagamento: 'pendente' }); dV.setMonth(dV.getMonth() + 1); }
        await supabaseClient.from('parcelas_pedido').insert(pI);
    }
    alert("Pedido refinanciado com sucesso!"); fecharModalEditar(); location.reload(); 
}

function abrirModalReajuste(id) { document.getElementById('reajuste_pedido_id').value = id; document.getElementById('modal_reajuste').classList.remove('hidden'); }
function fecharModalReajuste() { document.getElementById('modal_reajuste').classList.add('hidden'); }
async function salvarReajuste() {
    const id = document.getElementById('reajuste_pedido_id').value, nd = document.getElementById('nova_data_base').value; if (!nd) return alert("Selecione data.");
    const { data: ps } = await supabaseClient.from('parcelas_pedido').select('*').eq('pedido_id', id).eq('status_pagamento', 'pendente').order('numero_parcela', { ascending: true });
    if (!ps || ps.length === 0) return alert("Sem parcelas pendentes."); let db = new Date(nd + 'T00:00:00');
    for (let p of ps) { await supabaseClient.from('parcelas_pedido').update({ data_vencimento: db.toISOString().split('T')[0] }).eq('id', p.id); db.setMonth(db.getMonth() + 1); }
    fecharModalReajuste(); carregarVendas();
}
function filtrarVendas() { const nm = document.getElementById('filtro_nome').value.toLowerCase(), cp = document.getElementById('filtro_cpf').value.replace(/\D/g, ''), dt = document.getElementById('filtro_data').value; renderizarVendas(vendasGlobais.filter(v => v.clientes?.nome.toLowerCase().includes(nm) && v.clientes?.cpf.includes(cp) && (dt ? v.data_compra === dt : true))); }
function limparFiltros() { document.getElementById('filtro_nome').value = ''; document.getElementById('filtro_cpf').value = ''; document.getElementById('filtro_data').value = ''; renderizarVendas(vendasGlobais); }

// ==========================================
// 4. ESTOQUE E GESTÃO DE PRODUTOS
// ==========================================
function adicionarVariacao() {
    const c = document.getElementById('container_variacoes'), d = document.createElement('div'); d.className = "flex flex-wrap sm:flex-nowrap gap-2 items-end variacao-item mt-3 pt-3 border-t";
    d.innerHTML = `<div class="w-[45%] sm:flex-1"><label class="block text-[10px] sm:text-xs">Tipo</label><input type="text" required class="var-atributo mt-1 w-full rounded border p-2" placeholder="Ex: Cor"></div><div class="w-[45%] sm:flex-1"><label class="block text-[10px] sm:text-xs">Opção</label><input type="text" required class="var-valor mt-1 w-full rounded border p-2" placeholder="Ex: Azul"></div><div class="w-16"><label class="block text-[10px] sm:text-xs">Qtd</label><input type="number" required min="0" class="var-qtd mt-1 w-full rounded border p-2 text-center"></div><button type="button" onclick="this.parentElement.remove()" class="mb-1 text-red-500 font-bold px-1 py-1 text-lg">&times;</button>`;
    c.appendChild(d);
}

async function salvarProduto(ev) {
    ev.preventDefault();
    const { data: pD, error: pE } = await supabaseClient.from('produtos').insert([{ nome: document.getElementById('prod_nome').value, marca: document.getElementById('prod_marca').value, tipo: document.getElementById('prod_tipo').value, valor_base: parseFloat(document.getElementById('prod_valor').value), descricao: document.getElementById('prod_desc').value }]).select();
    if (pE) return alert("Erro: " + pE.message); const pI = pD[0].id;
    const vars = Array.from(document.querySelectorAll('.variacao-item')).map(i => { const a = i.querySelector('.var-atributo').value, v = i.querySelector('.var-valor').value; return { produto_id: pI, detalhe: (a.toLowerCase()==='único'||a==='') ? v : `${a}: ${v}`, quantidade_estoque: parseInt(i.querySelector('.var-qtd').value) } });
    await supabaseClient.from('produto_variacoes').insert(vars); alert("Salvo no Catálogo!"); document.getElementById('form_produto').reset(); carregarEstoque(); 
}

async function carregarEstoque() {
    const { data } = await supabaseClient.from('produtos').select(`id, nome, marca, tipo, valor_base, descricao, created_at, produto_variacoes(id, detalhe, quantidade_estoque)`).order('created_at', { ascending: false });
    estoqueLocal = data || []; renderizarEstoque(estoqueLocal); produtosPesquisaCache = [];
    estoqueLocal.forEach(p => { p.produto_variacoes.forEach(v => { if (v.quantidade_estoque > 0) produtosPesquisaCache.push({ id: v.id, nome_completo: `${p.nome} (${p.marca}) - ${v.detalhe}`, preco: p.valor_base, estoque: v.quantidade_estoque }); }); });
}

function renderizarEstoque(lista) {
    const c = document.getElementById('lista_estoque'); c.innerHTML = '';
    if (!lista || lista.length === 0) return c.innerHTML = `<div class="p-5 text-center text-slate-500 text-sm border rounded">Vazio.</div>`;
    lista.forEach(p => {
        let hV = ''; p.produto_variacoes.forEach(v => { hV += `<div class="flex justify-between py-1 border-b"><span class="text-xs sm:text-sm truncate mr-2">${v.detalhe}</span><span class="text-[10px] sm:text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${v.quantidade_estoque > 2 ? 'bg-slate-200' : 'bg-amber-100'}">${v.quantidade_estoque} no stock</span></div>`; });
        c.innerHTML += `<div class="bg-white p-3 sm:p-4 rounded-lg shadow-sm border mb-3"><div class="flex justify-between items-start"><div><div class="flex gap-1 mb-1 flex-wrap"><span class="text-[9px] font-bold bg-blue-100 text-blue-600 px-1 rounded">${p.tipo}</span><span class="text-[9px] font-bold bg-slate-100 px-1 rounded">${p.marca || 'S/ Marca'}</span></div><h3 class="font-bold text-xs sm:text-sm line-clamp-2 pr-2">${p.nome}</h3></div><div class="flex flex-col items-end gap-2 shrink-0"><span class="font-bold text-sm sm:text-base whitespace-nowrap">R$ ${p.valor_base.toFixed(2).replace('.', ',')}</span><div class="flex gap-1"><button onclick="abrirModalEditarProduto('${p.id}')" class="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-1.5 sm:py-1 rounded"><i class="fa-solid fa-pen"></i></button><button onclick="excluirProduto('${p.id}')" class="text-[10px] bg-red-100 text-red-700 px-2.5 py-1.5 sm:py-1 rounded"><i class="fa-solid fa-trash"></i></button></div></div></div><div class="mt-3 bg-slate-50 rounded p-2 sm:p-3">${hV}</div></div>`;
    });
}
function filtrarEstoque() { const t = document.getElementById('filtro_estoque').value.toLowerCase(); renderizarEstoque(estoqueLocal.filter(p => p.nome.toLowerCase().includes(t) || p.tipo.toLowerCase().includes(t) || (p.marca && p.marca.toLowerCase().includes(t)))); }

async function excluirProduto(idProduto) {
    if(confirm("Deseja eliminar este produto definitivamente?\n\nSe ele já estiver associado a vendas, não poderá ser apagado.")) {
        const { error } = await supabaseClient.from('produtos').delete().eq('id', idProduto);
        if (error) {
            if (error.message.includes('foreign key constraint') || error.message.includes('violates foreign key')) { alert("Bloqueio de Segurança: Este produto já foi vendido num pedido passado e não pode ser apagado.\n\nPara o remover da loja, edite-o e coloque o stock a 0."); } else { alert("Erro ao eliminar: " + error.message); }
            return;
        } alert("Produto eliminado!"); carregarEstoque();
    }
}

function abrirModalEditarProduto(idProduto) {
    const prod = estoqueLocal.find(p => p.id === idProduto); if(!prod) return;
    document.getElementById('edit_prod_id_base').value = prod.id; document.getElementById('edit_prod_nome').value = prod.nome; document.getElementById('edit_prod_marca').value = prod.marca || ''; document.getElementById('edit_prod_tipo').value = prod.tipo; document.getElementById('edit_prod_valor').value = prod.valor_base; document.getElementById('edit_prod_desc').value = prod.descricao || '';
    const container = document.getElementById('container_edit_variacoes'); container.innerHTML = ''; variacoesOriginaisEdit = [];
    prod.produto_variacoes.forEach(vr => {
        variacoesOriginaisEdit.push(vr.id); const div = document.createElement('div'); div.className = "flex flex-wrap sm:flex-nowrap gap-2 items-end edit-variacao-item";
        div.innerHTML = `<input type="hidden" class="e-var-id" value="${vr.id}"><div class="w-full sm:flex-1"><label class="block text-[10px] sm:text-xs">Variação</label><input type="text" required class="e-var-detalhe mt-1 w-full rounded border p-2 text-sm" value="${vr.detalhe}"></div><div class="w-20"><label class="block text-[10px] sm:text-xs">Stock</label><input type="number" required min="0" class="e-var-qtd mt-1 w-full rounded border p-2 text-center" value="${vr.quantidade_estoque}"></div><button type="button" onclick="this.parentElement.remove()" class="mb-1 text-red-500 font-bold px-2 py-1 text-lg">&times;</button>`;
        container.appendChild(div);
    });
    document.getElementById('modal_editar_produto').classList.remove('hidden');
}
function fecharModalEditarProduto() { document.getElementById('modal_editar_produto').classList.add('hidden'); }
function adicionarVariacaoEditModal() {
    const container = document.getElementById('container_edit_variacoes'), div = document.createElement('div'); div.className = "flex flex-wrap sm:flex-nowrap gap-2 items-end edit-variacao-item";
    div.innerHTML = `<input type="hidden" class="e-var-id" value=""><div class="w-full sm:flex-1"><label class="block text-[10px] sm:text-xs">Variação (Ex: Tam: 40)</label><input type="text" required class="e-var-detalhe mt-1 w-full rounded border p-2 text-sm"></div><div class="w-20"><label class="block text-[10px] sm:text-xs">Stock</label><input type="number" required min="0" class="e-var-qtd mt-1 w-full rounded border p-2 text-center"></div><button type="button" onclick="this.parentElement.remove()" class="mb-1 text-red-500 font-bold px-2 py-1 text-lg">&times;</button>`;
    container.appendChild(div);
}
async function salvarEdicaoProduto(event) {
    event.preventDefault(); const btn = document.getElementById('btn_salvar_edit_prod'); btn.innerText = "A guardar..."; btn.disabled = true; const idProd = document.getElementById('edit_prod_id_base').value;
    const { error: errProd } = await supabaseClient.from('produtos').update({ nome: document.getElementById('edit_prod_nome').value, marca: document.getElementById('edit_prod_marca').value, tipo: document.getElementById('edit_prod_tipo').value, valor_base: parseFloat(document.getElementById('edit_prod_valor').value), descricao: document.getElementById('edit_prod_desc').value }).eq('id', idProd);
    if (errProd) { alert("Erro ao atualizar base: " + errProd.message); btn.innerText = "Salvar Alterações"; btn.disabled = false; return; }
    const divs = Array.from(document.querySelectorAll('.edit-variacao-item')); const idsAtuais = [];
    for (let div of divs) {
        const vId = div.querySelector('.e-var-id').value, vDet = div.querySelector('.e-var-detalhe').value, vQtd = parseInt(div.querySelector('.e-var-qtd').value);
        if (vId) { idsAtuais.push(vId); await supabaseClient.from('produto_variacoes').update({ detalhe: vDet, quantidade_estoque: vQtd }).eq('id', vId); } else { await supabaseClient.from('produto_variacoes').insert([{ produto_id: idProd, detalhe: vDet, quantidade_estoque: vQtd }]); }
    }
    for (let oldId of variacoesOriginaisEdit) {
        if (!idsAtuais.includes(oldId)) {
            const { error: errDel } = await supabaseClient.from('produto_variacoes').delete().eq('id', oldId);
            if (errDel && errDel.message.includes('foreign key')) { await supabaseClient.from('produto_variacoes').update({ quantidade_estoque: 0 }).eq('id', oldId); alert("Aviso: Variações associadas a vendas antigas não foram apagadas. Stock zerado por segurança."); }
        }
    }
    alert("Catálogo atualizado!"); fecharModalEditarProduto(); btn.innerText = "Salvar Alterações"; btn.disabled = false; carregarEstoque();
}
window.onload = () => { carregarEstoque(); };