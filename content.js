// ==UserScript==
// @name         Preenchedor Automático SICAD - Simulação Nativa de Teclado
// @namespace    http://tampermonkey.net/
// @version      4.7
// @description  Lê texto base filtrando somente caracteres alfanuméricos, reconhece nomes com asteriscos/observações de desempate, converte notas com ponto (.) e preenche dados no SICAD.
// @match        *://*sicad*/*
// @match        *://*ssp.go.gov.br/*
// @allFrames    true
// @grant        none
// ==/==

(function() {
    'use strict';

    if (!document.getElementById('btnAutoPreencherSicad')) {
        const btn = document.createElement('button');
        btn.id = 'btnAutoPreencherSicad';
        btn.innerHTML = '📋 Auto Preencher';
        btn.style.cssText = `
            position: fixed; bottom: 20px; left: 20px; z-index: 999999;
            padding: 12px 20px; background-color: #007bff; color: white;
            border: none; border-radius: 25px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            font-weight: bold; cursor: pointer; font-size: 14px; display: none;
        `;
        document.body.appendChild(btn);

        const drawer = document.createElement('div');
        drawer.id = 'drawerAutoPreencherSicad';
        drawer.style.cssText = `
            display: none; position: fixed; top: 0; left: 0; width: 450px; height: 100vh;
            z-index: 1000000; background: #ffffff; box-shadow: 4px 0 15px rgba(0,0,0,0.2);
            padding: 20px; box-sizing: border-box; overflow-y: auto; border-right: 2px solid #007bff;
        `;
        drawer.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="margin:0; font-size:16px; color:#333;">Importar Planilha</h3>
                <button id="btnFecharDrawer" style="background:none; border:none; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
            </div>

            <div style="background-color: #fff3cd; color: #856404; border: 1px solid #ffeeba; padding: 10px; border-radius: 6px; font-size: 11px; margin-bottom: 12px; line-height: 1.4;">
                <strong style="display:block; margin-bottom:4px; font-size:12px;">⚠️ FORMATO OBRIGATÓRIO DE SAÍDA:</strong>
                O filtro organizará as informações na seguinte ordem (exatamente 1 policial por linha):<br>
                <div style="background:#fff; padding:6px; border:1px dashed #856404; margin-top:6px; font-family:monospace; font-weight:bold; text-align:center;">
                    CLASSIFICAÇÃO / RG / NOME / NOTA
                </div>
                <span style="display:block; margin-top:4px; font-size:10px; color:#6c757d;">Exemplo: 1º / 38579 / YURI ALVES PINHEIRO DOS SANTOS / 9.73000000</span>
            </div>

            <!-- CAMPO 1: ENTRADA BRUTA -->
            <label style="font-size:12px; font-weight:bold; color:#555; display:block; margin-bottom:4px;">1. Cole a lista/planilha bruta aqui:</label>
            <textarea id="dadosBrutos" style="width:100%; height:130px; box-sizing:border-box; margin-bottom:8px; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:monospace; font-size:11px; resize:none;" placeholder="Cole o texto ou tabela do Excel sem tratamento..."></textarea>
            
            <button id="btnFiltrar" style="width:100%; padding:8px; background:#17a2b8; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer; margin-bottom:12px; font-size:12px;">⚡ Filtrar e Formatar Dados</button>

            <!-- CAMPO 2: DADOS PRONTOS/FORMATADOS -->
            <label style="font-size:12px; font-weight:bold; color:#555; display:block; margin-bottom:4px;">2. Dados formatados e organizados (1 por linha):</label>
            <textarea id="dadosCopiados" wrap="off" style="width:100%; height:180px; box-sizing:border-box; margin-bottom:12px; padding:8px; border:1px solid #ccc; border-radius:4px; font-family:'Courier New', Courier, monospace; font-size:11px; resize:none; background-color:#f8f9fa; white-space:pre; overflow-x:auto;" placeholder="Os dados formatados aparecerão aqui (1 militar por linha)..."></textarea>
            
            <div style="display:flex; gap:10px;">
                <button id="btnProcessar" style="flex:2; padding:10px; background:#28a745; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">🚀 Processar e Preencher</button>
                <button id="btnLimparTexto" style="flex:1; padding:10px; background:#dc3545; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">🗑️ Limpar</button>
            </div>
        `;
        document.body.appendChild(drawer);

        btn.onclick = () => drawer.style.display = 'block';
        document.getElementById('btnFecharDrawer').onclick = () => drawer.style.display = 'none';

        document.getElementById('btnLimparTexto').onclick = function() {
            document.getElementById('dadosBrutos').value = '';
            document.getElementById('dadosCopiados').value = '';
            document.getElementById('dadosBrutos').focus();
        };

        function obterTodosDocumentos(win = window) {
            let docs = [];
            try {
                docs.push(win.document);
                for (let i = 0; i < win.frames.length; i++) {
                    try {
                        docs = docs.concat(obterTodosDocumentos(win.frames[i]));
                    } catch (e) {}
                }
            } catch (e) {}
            return docs;
        }

        function verificarCondicao() {
            const todosDocs = obterTodosDocumentos();
            let temGeral = false;
            let tem2Parte = false;
            let temEnsino = false;

            todosDocs.forEach(doc => {
                const selects = Array.from(doc.querySelectorAll('select'));
                selects.forEach(select => {
                    const textoSelecionado = select.options[select.selectedIndex]?.text.trim().toUpperCase() || '';
                    if (textoSelecionado.includes('GERAL')) temGeral = true;
                    if (textoSelecionado.includes('2ª PARTE') || textoSelecionado.includes('2A PARTE') || textoSelecionado.includes('2 PARTE')) tem2Parte = true;
                    if (textoSelecionado.includes('ENSINO')) temEnsino = true;
                });
            });

            if (temGeral && tem2Parte && temEnsino) {
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
                drawer.style.display = 'none';
            }
        }

        setInterval(verificarCondicao, 1000);
        document.addEventListener('change', verificarCondicao);

        /**
         * 1º REQUISITO: Leitura e normalização de caracteres exclusivamente alfanuméricos.
         * Desconsidera caracteres especiais (pontuações, asteriscos, hífens, etc.) e acentos,
         * mantendo somente letras [A-Z], números [0-9] e espaços simples.
         */
        function normalizar(texto) {
            if (!texto) return '';
            return texto.toString()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Remove acentuações
                .replace(/[^a-zA-Z0-9\s]/g, " ") // Desconsidera caracteres especiais substituindo por espaço
                .replace(/\s+/g, " ")            // Consolida múltiplos espaços
                .trim()
                .toUpperCase();
        }

        /**
         * Identifica linhas que são cabeçalhos, observações ou critérios de desempate (ex: "(Desempate pelo critério de antiguidade)")
         */
        function isLinhaIgnoravel(texto) {
            if (!texto) return true;
            const raw = texto.toString().trim();
            if (!raw) return true;

            const t = normalizar(raw);
            if (!t) return true;

            // Cabeçalhos de tabelas
            if (t.startsWith('APROVADOS') || t.startsWith('VERIFICACAO') || t.startsWith('RECUPERACAO')) return true;
            if (t === 'QTD' || t === 'QUANTIDADE') return true;
            if (t === 'GRADUACAO' || t === 'POSTO' || t === 'POSTO GRADUACAO') return true;
            if (t === 'RG' || t === 'NOME' || t === 'MEDIA' || t === 'NOTA' || t === 'CLASSIFICACAO') return true;

            // Observações e notas de desempate
            if (t.includes('DESEMPATE') || t.includes('CRITERIO DE ANTIGUIDADE') || t.includes('CRITERIO DE IDADE')) return true;
            if (t.startsWith('OBSERVACAO') || t.startsWith('OBS') || t.includes('DISCENTES CUJO NOME') || t.includes('NOTAS IDENTICAS')) return true;

            // Linhas totalmente entre parênteses
            if (raw.startsWith('(') && raw.endsWith(')')) return true;

            return false;
        }

        /**
         * Limpeza e extração de Nome:
         * Remove observações em parênteses, asteriscos (*), notas de desempate e caracteres especiais.
         */
        function limparNome(texto) {
            if (!texto) return '';
            let n = texto.toString();
            // Remove conteúdo entre parênteses e colchetes
            n = n.replace(/\([^)]*\)/g, ' ');
            n = n.replace(/\[[^\]]*\]/g, ' ');
            // Remove termos de desempate soltos
            n = n.replace(/desempate\s+pelo\s+crit[eé]rio\s+de\s+antiguidade/gi, ' ');
            n = n.replace(/crit[eé]rio\s+de\s+antiguidade/gi, ' ');
            // Converte para alfanumérico limpo (letras e números)
            return normalizar(n);
        }

        /**
         * Limpeza de RG: desconsidera pontos, hífens e caracteres especiais,
         * mantendo apenas os dígitos numéricos.
         */
        function limparRG(rgRaw) {
            if (!rgRaw) return '';
            return rgRaw.toString().replace(/\D/g, '').trim();
        }

        /**
         * Limpeza de Classificação:
         * Desconsidera caracteres especiais e o total após a barra (ex: "1º/33" -> "1º", "27º/33" -> "27º").
         */
        function limparClassificacao(classifRaw) {
            if (!classifRaw) return '';
            const parteAntesBarra = classifRaw.toString().split('/')[0];
            const num = parteAntesBarra.replace(/\D/g, '');
            return num ? `${num}º` : '';
        }

        /**
         * 2º REQUISITO: Tratamento e conversão de padrão de nota.
         * Onde encontrar vírgula (,), converte obrigatoriamente para ponto (.).
         * Desconsidera caracteres especiais, preservando as casas decimais para o SICAD (ex: 0.00 a 10.00).
         */
        function tratarNota(notaRaw) {
            if (!notaRaw) return '0.00';
            let strNota = notaRaw.toString().trim();
            // Converte vírgula para ponto
            strNota = strNota.replace(/,/g, '.');
            // Remove quaisquer caracteres especiais, mantendo apenas números e o ponto decimal
            strNota = strNota.replace(/[^0-9.]/g, '');

            const partes = strNota.split('.');
            if (partes.length > 2) {
                strNota = partes[0] + '.' + partes.slice(1).join('');
            }

            if (!strNota || isNaN(parseFloat(strNota))) {
                return '0.00';
            }
            return strNota;
        }

        function adequarNotaAoCampo(notaRaw, inputElement) {
            return tratarNota(notaRaw);
        }

        // SIMULAÇÃO DE DIGITAÇÃO DIRETA PARA ATIVAR AS MÁSCARAS NATIVAS DO SICAD
        function simularDigitacaoNativa(element, valor) {
            element.focus();
            element.select();
            
            try {
                element.ownerDocument.execCommand('insertText', false, valor);
            } catch (e) {
                element.value = valor;
            }

            if (element.value !== valor) {
                element.value = valor;
            }

            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.dispatchEvent(new Event('keyup', { bubbles: true }));
            element.dispatchEvent(new Event('blur', { bubbles: true }));
        }

        function isPostoGraduacao(texto) {
            if (!texto) return false;
            const postos = [
                'CABO QPPM', 'SOLDADO QPPM', 'SOLDADO 1A CLASSE', 'SOLDADO 2A CLASSE',
                'SD QPPM', 'SD 1A CL PM', 'SD 2A CL PM', 'SD PM', 'SOLDADO', 'SD',
                'CB QPPM', 'CB PM', 'CABO', 'CB',
                '3 SARGENTO QPPM', '2 SARGENTO QPPM', '1 SARGENTO QPPM',
                '3 SARGENTO', '2 SARGENTO', '1 SARGENTO', 'SARGENTO QPPM', 'SARGENTO',
                '3 SGT QPPM', '2 SGT QPPM', '1 SGT QPPM', 'SGT QPPM',
                '3 SGT PM', '2 SGT PM', '1 SGT PM', '1 SGT', '2 SGT', '3 SGT', 'SGT PM', 'SGT',
                'SUBTEN PM', 'SUB TEN PM', 'SUBTENENTE PM', 'SUBTENENTE', 'SUBTEN', 'SUB TEN',
                'ASPIRANTE PM', 'ASP PM', 'ASPIRANTE', 'ASP',
                '2 TEN PM', '1 TEN PM', 'TEN PM', 'TENENTE PM', 'TENENTE', 'TEN',
                'CAP PM', 'CAPITAO PM', 'CAPITAO', 'CAP',
                'MAJ PM', 'MAJOR PM', 'MAJOR', 'MAJ',
                'TEN CEL PM', 'TENENTE CORONEL PM', 'TENENTE CORONEL', 'TEN CEL',
                'CEL PM', 'CORONEL PM', 'CORONEL', 'CEL',
                'ALUNO', 'CADETE', 'QPPM', 'QPE'
            ];
            return postos.includes(normalizar(texto));
        }

        /**
         * Extrai registro quando os dados do policial estão em uma única linha
         * (seja separado por barras '/', tabulações '\t', ponto-e-vírgula ';', traços ' - ' ou espaços).
         */
        function extrairRegistroDeLinha(linha) {
            if (!linha || !linha.trim()) return null;

            // Pré-converte vírgula decimal para ponto
            let linhaTratada = linha.replace(/(\d+),(\d+)/g, '$1.$2');

            let partes = [];
            if (linhaTratada.includes('\t')) {
                partes = linhaTratada.split('\t');
            } else if (linhaTratada.includes('/')) {
                partes = linhaTratada.split('/');
            } else if (linhaTratada.includes(';')) {
                partes = linhaTratada.split(';');
            } else if (linhaTratada.includes('|')) {
                partes = linhaTratada.split('|');
            } else if (linhaTratada.includes(' - ')) {
                partes = linhaTratada.split(' - ');
            }

            if (partes.length >= 4) {
                const p0Classif = limparClassificacao(partes[0]);
                const p1RG = limparRG(partes[1]);
                const p2Nome = limparNome(partes[2]);
                const p3Nota = tratarNota(partes[3]);

                if (p1RG && p1RG.length >= 3 && p2Nome.length >= 3 && p3Nota !== '0.00') {
                    return {
                        classif: p0Classif || '1º',
                        rg: p1RG,
                        nome: p2Nome,
                        nota: p3Nota
                    };
                }

                // Identificação dinâmica de colunas
                let cClassif = '';
                let cRG = '';
                let cNome = '';
                let cNota = '';

                for (let i = 0; i < partes.length; i++) {
                    const rawPart = partes[i].trim();
                    if (isLinhaIgnoravel(rawPart)) continue;

                    const rgCand = limparRG(rawPart);
                    const notaCand = rawPart.match(/^\d{1,2}\.\d+$/) ? tratarNota(rawPart) : '';
                    const classCand = limparClassificacao(rawPart);
                    const nomeCand = limparNome(rawPart);

                    if (!cNota && notaCand && parseFloat(notaCand) <= 10.0) {
                        cNota = notaCand;
                    } else if (!cRG && rgCand && rgCand.length >= 4 && rgCand.length <= 8 && !cNota?.includes(rgCand)) {
                        cRG = rgCand;
                    } else if (!cClassif && classCand && (rawPart.includes('º') || rawPart.includes('°') || rawPart.includes('/') || i === 0 || i === partes.length - 1)) {
                        cClassif = classCand;
                    } else if (!cNome && nomeCand.length >= 4 && !isPostoGraduacao(nomeCand) && !isLinhaIgnoravel(nomeCand)) {
                        cNome = nomeCand;
                    }
                }

                if (cRG && cNome && cNota) {
                    return {
                        classif: cClassif || '1º',
                        rg: cRG,
                        nome: cNome,
                        nota: cNota
                    };
                }
            }

            // Tentativa por regex em linha contínua
            const matchLinha = linhaTratada.match(/^(?:(\d+)[º°ª]?\s+)?(?:RG:?\s*)?(\d{1,3}\.?\d{3}|\d{4,8})\s+(.+?)\s+(?:NOTA:?\s*)?(\d{1,2}\.\d+)\s*$/i);
            if (matchLinha) {
                const rawClass = matchLinha[1] ? `${matchLinha[1]}º` : '1º';
                const rawRG = limparRG(matchLinha[2]);
                const rawNome = limparNome(matchLinha[3]);
                const rawNota = tratarNota(matchLinha[4]);

                if (rawRG && rawNome && rawNota) {
                    return {
                        classif: rawClass,
                        rg: rawRG,
                        nome: rawNome,
                        nota: rawNota
                    };
                }
            }

            return null;
        }

        /**
         * Extrai registros quando os dados foram colados em múltiplas linhas por pessoa.
         * Suporta perfeitamente nomes seguidos de asteriscos '*' e observações de desempate em linhas separadas.
         */
        function extrairRegistrosMultiLinhas(linhas) {
            const registros = [];

            // 1. Identifica os índices de todas as linhas de classificação (ex: "1º/33", "27º/33", "1º", etc.)
            const indicesClassif = [];
            for (let i = 0; i < linhas.length; i++) {
                const l = linhas[i].trim();
                if (l.match(/^\d+.*?\/[\s\d]+$/) || l.match(/^\d+[º°ª]$/)) {
                    indicesClassif.push(i);
                }
            }

            // Se encontrou linhas de classificação por barra (ex: "1º/33")
            if (indicesClassif.length > 0) {
                let ultimoIdx = 0;

                for (let c = 0; c < indicesClassif.length; c++) {
                    const idxC = indicesClassif[c];
                    const classif = limparClassificacao(linhas[idxC]) || `${c + 1}º`;

                    // A linha imediatamente anterior à classificação é a MÉDIA (Nota)
                    const idxNota = idxC - 1;
                    if (idxNota < 0) continue;

                    const rawNota = linhas[idxNota];
                    const nota = tratarNota(rawNota);

                    // Linhas do bloco entre o candidato anterior e a nota deste
                    const blocoLinhas = [];
                    for (let j = ultimoIdx; j < idxNota; j++) {
                        blocoLinhas.push(linhas[j].trim());
                    }
                    ultimoIdx = idxC + 1;

                    // Encontra o RG no bloco
                    let idxRGNoBloco = -1;
                    let rg = '';
                    for (let k = 0; k < blocoLinhas.length; k++) {
                        const l = blocoLinhas[k];
                        if (l.match(/^\d{1,3}\.\d{3}$/) || l.match(/^\d{4,8}$/) || l.match(/^RG:?\s*\d+/i)) {
                            rg = limparRG(l);
                            idxRGNoBloco = k;
                            break;
                        }
                    }

                    // O Nome fica nas linhas APÓS o RG e ANTES da Nota (ignorando notas de desempate)
                    let nome = '';
                    if (idxRGNoBloco >= 0) {
                        for (let k = idxRGNoBloco + 1; k < blocoLinhas.length; k++) {
                            const l = blocoLinhas[k];
                            if (isLinhaIgnoravel(l)) continue;
                            const nomeCand = limparNome(l);
                            if (nomeCand.length >= 3 && !isLinhaIgnoravel(nomeCand) && !isPostoGraduacao(nomeCand)) {
                                nome = nomeCand;
                                break;
                            }
                        }
                    } else {
                        // Caso o RG não esteja no formato padrão, procura nome em qualquer linha do bloco
                        for (let k = 0; k < blocoLinhas.length; k++) {
                            const l = blocoLinhas[k];
                            if (isLinhaIgnoravel(l) || isPostoGraduacao(l) || l.match(/^\d+$/)) continue;
                            const nomeCand = limparNome(l);
                            if (nomeCand.length >= 3 && !isLinhaIgnoravel(nomeCand)) {
                                nome = nomeCand;
                                break;
                            }
                        }
                    }

                    if (rg && nome && nota && nota !== '0.00') {
                        registros.push({
                            classif: classif,
                            rg: rg,
                            nome: nome,
                            nota: nota
                        });
                    }
                }

                if (registros.length > 0) {
                    return registros;
                }
            }

            // 2. Fallback: Varredura sequencial direta (caso o padrão acima não tenha capturado)
            let tempClassif = '';
            let tempRG = '';
            let tempNome = '';
            let tempNota = '';

            for (let j = 0; j < linhas.length; j++) {
                const lOriginal = linhas[j].trim();
                if (!lOriginal || isLinhaIgnoravel(lOriginal)) continue;

                const lPonto = lOriginal.replace(/(\d+),(\d+)/g, '$1.$2');

                if (lPonto.match(/^\d+.*?\/[\s\d]+$/) || lPonto.match(/^\d+[º°ª]$/)) {
                    tempClassif = limparClassificacao(lPonto);
                } else if (lPonto.match(/^(?:RG:?\s*)?(\d{1,3}\.\d{3}|\d{4,8})(?:-\w)?$/i)) {
                    tempRG = limparRG(lPonto);
                } else if (lPonto.match(/^(?:NOTA:?\s*)?\d{1,2}\.\d+$/i) || lOriginal.match(/^(?:NOTA:?\s*)?\d{1,2},\d+$/i)) {
                    tempNota = tratarNota(lPonto);
                } else if (!isPostoGraduacao(lOriginal) && !lOriginal.match(/^\d+$/)) {
                    const nomeNorm = limparNome(lOriginal);
                    if (nomeNorm.length >= 3 && !isPostoGraduacao(nomeNorm) && !isLinhaIgnoravel(nomeNorm)) {
                        tempNome = nomeNorm;
                    }
                }

                if (tempRG && tempNome && tempNota) {
                    registros.push({
                        classif: tempClassif || `${registros.length + 1}º`,
                        rg: tempRG,
                        nome: tempNome,
                        nota: tempNota
                    });
                    tempClassif = '';
                    tempRG = '';
                    tempNome = '';
                    tempNota = '';
                }
            }

            return registros;
        }

        // LEITURA E FILTRAGEM DE DADOS
        document.getElementById('btnFiltrar').onclick = function() {
            const rawText = document.getElementById('dadosBrutos').value;
            if (!rawText.trim()) {
                alert('Cole primeiro a lista bruta de dados para filtrar.');
                return;
            }

            const linhas = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            let registrosExtraidos = [];

            // 1. Tenta interpretar como registros de linha única
            linhas.forEach(linha => {
                const reg = extrairRegistroDeLinha(linha);
                if (reg) {
                    registrosExtraidos.push(reg);
                }
            });

            // 2. Se não encontrou linha a linha, tenta como estrutura multi-linhas
            if (registrosExtraidos.length === 0) {
                registrosExtraidos = extrairRegistrosMultiLinhas(linhas);
            }

            if (registrosExtraidos.length > 0) {
                const linhasFormatadas = registrosExtraidos.map((r, index) => {
                    const classifFinal = r.classif ? r.classif : `${index + 1}º`;
                    const notaFinal = tratarNota(r.nota);
                    return `${classifFinal} / ${r.rg} / ${r.nome} / ${notaFinal}`;
                });

                document.getElementById('dadosCopiados').value = linhasFormatadas.join('\n');
            } else {
                alert('Não foi possível identificar a estrutura da lista. Tente colar novamente.');
            }
        };

        // PROCESSAMENTO E ENVIO
        document.getElementById('btnProcessar').onclick = function() {
            const rawText = document.getElementById('dadosCopiados').value;
            if (!rawText.trim()) {
                alert('A caixa de dados formatados está vazia. Realize a filtragem primeiro.');
                return;
            }

            const linhasEntrada = rawText.split('\n');
            let preenchidos = 0;
            let ignorados = 0;
            const todosDocs = obterTodosDocumentos();

            linhasEntrada.forEach(linhaTexto => {
                if (!linhaTexto.trim()) return;

                const partes = linhaTexto.split('/').map(p => p.trim());

                if (partes.length >= 4) {
                    const rawClassif = partes[0];
                    const rawRG = partes[1];
                    const rawNome = partes[2];
                    const rawNota = partes[3];

                    const classif = rawClassif.replace(/\D/g, '');
                    const rgColado = rawRG.replace(/\D/g, '').trim();
                    const nomeColadoNorm = normalizar(rawNome);

                    todosDocs.forEach(doc => {
                        const trs = doc.querySelectorAll('tr');
                        trs.forEach(tr => {
                            const tds = tr.querySelectorAll('td');
                            if (tds.length >= 6) {
                                const rgTabela = normalizar(tds[0]?.innerText || '').replace(/\D/g, '');
                                const nomeTabela = normalizar(tds[2]?.innerText || '');

                                if (rgTabela && nomeTabela) {
                                    const bateuRG = rgColado && (rgTabela === rgColado || rgTabela.includes(rgColado) || rgColado.includes(rgTabela));
                                    const bateuNome = nomeTabela.length > 3 && (nomeTabela.includes(nomeColadoNorm) || nomeColadoNorm.includes(nomeTabela));

                                    if (bateuRG && bateuNome) {
                                        const inputClassif = tr.querySelector('input[name*="classi"], input[name*="CLASSI"], input[id*="classi"]') || tds[3]?.querySelector('input');
                                        const inputNota = tr.querySelector('input[name*="nota"], input[name*="NOTA"], input[id*="nota"]') || tds[6]?.querySelector('input');

                                        if (inputClassif && classif) {
                                            simularDigitacaoNativa(inputClassif, classif);
                                        }

                                        if (inputNota && rawNota) {
                                            const notaTratada = adequarNotaAoCampo(rawNota, inputNota);
                                            simularDigitacaoNativa(inputNota, notaTratada);
                                        }

                                        preenchidos++;
                                    } else if (bateuRG || bateuNome) {
                                        ignorados++;
                                    }
                                }
                            }
                        });
                    });
                }
            });

            let msg = `Processamento concluído!\n• ${preenchidos} militar(es) preenchido(s) com sucesso.`;
            if (ignorados > 0) {
                msg += `\n• ${ignorados} registro(s) ignorado(s) por divergência entre RG e Nome.`;
            }
            alert(msg);
            drawer.style.display = 'none';
        };
    }
})();