import express from "express";
import sdk from "stremio-addon-sdk";
const { addonBuilder, getRouter } = sdk;

// Manifesto base do Addon para Stremio
const manifest = {
    id: "community.stremio-show-subtitle-pt-br",
    version: "1.1.0",
    name: "Show Subtitle PT-BR",
    description: "Mostra na lista de fontes de vídeo do Stremio se há legendas em português (PT-BR) disponíveis no OpenSubtitles (💬) ou áudio dublado (🔊).",
    resources: ["stream"],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt"],
    config: [
        {
            key: "resolution",
            type: "select",
            title: "Filtro de Resolução",
            options: [
                "Todas as Resoluções (All)",
                "Apenas 4K (2160p)",
                "Apenas 1080p (Full HD)",
                "Apenas 720p (HD)",
                "Apenas 480p (SD)",
                "1080p e 4K (Full HD & 4K)",
                "720p ou superior (720p, 1080p, 4K)"
            ],
            default: "Todas as Resoluções (All)"
        },
        {
            key: "upstreamUrls",
            type: "text",
            title: "URLs dos Addons Upstream (separadas por vírgula)",
            default: "https://torrentio.strem.fun, https://torrentio.strem.fun/lite, https://torrentio.strem.fun/brazuca"
        }
    ],
    behaviorHints: {
        configurable: true,
        configurationRequired: false
    }
};

/**
 * Fontes padrão de backup
 */
const DEFAULT_UPSTREAMS = [
    "https://torrentio.strem.fun",
    "https://torrentio.strem.fun/lite",
    "https://torrentio.strem.fun/brazuca"
];

/**
 * Ordem de prioridade para exibição dos streams no Stremio
 */
const RESOLUTION_PRIORITY = {
    "4k": 1,
    "1080p": 2,
    "720p": 3,
    "480p": 4,
    "unknown": 5
};

/**
 * Obtém o selo conciso da resolução selecionada para exibição limpa no Stremio.
 */
function getResolutionLabel(resolutionKey) {
    if (!resolutionKey) return "Todas as Resoluções";
    const res = resolutionKey.toLowerCase();

    if (res.includes("4k") && !res.includes("1080p") && !res.includes("720p") && !res.includes("all") && !res.includes("todas")) {
        return "4K Apenas";
    }
    if (res.includes("1080p") && !res.includes("4k") && !res.includes("720p") && !res.includes("all") && !res.includes("todas")) {
        return "1080p Apenas";
    }
    if (res.includes("720p") && !res.includes("1080p") && !res.includes("4k") && !res.includes("all") && !res.includes("todas")) {
        return "720p Apenas";
    }
    if (res.includes("480p")) {
        return "480p Apenas";
    }
    if (res.includes("1080p_above") || res.includes("full hd & 4k") || res.includes("full hd + 4k")) {
        return "1080p e 4K";
    }
    if (res.includes("720p_above") || res.includes("720p ou superior")) {
        return "720p ou superior";
    }

    return "Todas as Resoluções";
}

/**
 * Detecta a resolução de um stream analisando nome, título, descrição e qualidade.
 */
function detectResolution(stream) {
    if (!stream) return "unknown";

    const textToAnalyze = [
        stream.name,
        stream.title,
        stream.description,
        stream.quality
    ].filter(Boolean).join(" ");

    if (/\b(4k|2160p|uhd|2160)\b/i.test(textToAnalyze)) {
        return "4k";
    }
    if (/\b(1080p|1080|fhd|full[\s._-]?hd)\b/i.test(textToAnalyze)) {
        return "1080p";
    }
    if (/\b(720p|720|hd)\b/i.test(textToAnalyze)) {
        if (!/\b(h264|x264|h265|x265)\b/i.test(textToAnalyze) || /\b720p?\b/i.test(textToAnalyze)) {
            return "720p";
        }
    }
    if (/\b(480p|480|sd|360p|360)\b/i.test(textToAnalyze)) {
        return "480p";
    }

    return "unknown";
}

/**
 * Formata o nome da fonte adicionando indicadores de idioma e mantendo o menu organizado.
 */
function formatStreamName(stream, resolution, hasPtSubtitle, config) {
    const rawName = (stream.name || "").trim();
    // Pega o provedor da primeira linha (ex: Torrentio)
    const providerLine = rawName.split("\n")[0] || "Stream";
    const cleanProvider = providerLine.replace(/!/g, "").trim();

    const displayRes = resolution !== "unknown" ? resolution.toUpperCase() : "";

    // Analisa se o próprio vídeo está dublado em Português
    const textToAnalyze = [
        stream.name,
        stream.title,
        stream.description,
        stream.quality
    ].filter(Boolean).join(" ").toLowerCase();

    // Palavras-chave que sinalizam dublagem em PT ou áudio original em PT
    const isDubbed = /\b(dublado|dub|dual|multi|pt[-_]?br|portugues|brazuca)\b/i.test(textToAnalyze);

    // Monta os indicadores visuais
    let indicators = "";
    if (isDubbed && hasPtSubtitle) {
        indicators = "🔊💬"; // Áudio PT-BR e Legenda PT-BR
    } else if (isDubbed) {
        indicators = "🔊"; // Apenas Áudio PT-BR
    } else if (hasPtSubtitle) {
        indicators = "💬"; // Apenas Legenda PT-BR
    } else {
        indicators = "❌"; // Nenhuma opção em PT-BR detectada
    }

    const label = getResolutionLabel(config?.resolution);
    // Prefixo '!' força a ordenação no topo da lista do menu do Stremio
    const headerName = `! [${indicators}] (${label})`;

    return displayRes 
        ? `${headerName}\n${cleanProvider} - ${displayRes}` 
        : `${headerName}\n${cleanProvider}`;
}

/**
 * Verifica se a resolução detectada é permitida de acordo com a seleção.
 */
function isResolutionAllowed(resolution, config) {
    if (!config) return true;
    if (resolution === "unknown") return true;

    const selectedRes = (config.resolution || "").toLowerCase();

    if (selectedRes.includes("4k") && !selectedRes.includes("1080p") && !selectedRes.includes("720p") && !selectedRes.includes("all") && !selectedRes.includes("todas")) {
        return resolution === "4k";
    }
    if (selectedRes.includes("1080p") && !selectedRes.includes("4k") && !selectedRes.includes("720p") && !selectedRes.includes("all") && !selectedRes.includes("todas")) {
        return resolution === "1080p";
    }
    if (selectedRes.includes("720p") && !selectedRes.includes("1080p") && !selectedRes.includes("4k") && !selectedRes.includes("all") && !selectedRes.includes("todas")) {
        return resolution === "720p";
    }
    if (selectedRes.includes("480p")) {
        return resolution === "480p";
    }
    if (selectedRes.includes("1080p_above") || selectedRes.includes("full hd & 4k") || selectedRes.includes("full hd + 4k")) {
        return resolution === "1080p" || resolution === "4k";
    }
    if (selectedRes.includes("720p_above") || selectedRes.includes("720p ou superior")) {
        return resolution === "720p" || resolution === "1080p" || resolution === "4k";
    }

    return true;
}

/**
 * Extrai lista de URLs de upstream configuradas pelo usuário.
 */
function getUpstreamUrls(config) {
    const rawUrls = config?.upstreamUrls || config?.upstreamUrl;
    if (!rawUrls || typeof rawUrls !== "string" || !rawUrls.trim()) {
        return DEFAULT_UPSTREAMS;
    }

    const urls = rawUrls
        .split(",")
        .map(url => url.trim().replace(/\/manifest\.json$/i, "").replace(/\/+$/, ""))
        .filter(url => url.startsWith("http://") || url.startsWith("https://"));

    return urls.length > 0 ? urls : DEFAULT_UPSTREAMS;
}

// Inicializa o construtor do Addon Stremio
const builder = new addonBuilder(manifest);

// Handler de Streams
builder.defineStreamHandler(async ({ type, id, config }) => {
    console.log(`[Stream Request] Type: ${type}, ID: ${id}`);

    // Consultamos o OpenSubtitles em paralelo para evitar lentidão
    const subUrl = `https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(id)}.json`;
    const fetchSubsPromise = fetch(subUrl, { signal: AbortSignal.timeout(3000) })
        .then(async (res) => {
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.subtitles)) {
                    // pob = Português Brasileiro (Portuguese Brazil), por = Português Geral/Europeu
                    const hasPt = data.subtitles.some(s => s.lang === 'pob' || s.lang === 'por');
                    return { hasPt };
                }
            }
            return { hasPt: false };
        })
        .catch((err) => {
            console.error(`[Subtitle Check] Falha ao verificar OpenSubtitles para ${id}:`, err.message);
            return { hasPt: false };
        });

    const upstreamUrls = getUpstreamUrls(config);

    const fetchStreamsPromises = upstreamUrls.map(async (baseUrl) => {
        const streamUrl = `${baseUrl}/stream/${type}/${id}.json`;
        try {
            const response = await fetch(streamUrl, {
                signal: AbortSignal.timeout(4000)
            });
            if (response.ok) {
                const data = await response.json();
                return data.streams || [];
            }
        } catch (error) {
            console.error(`[Stream Request] Erro ao consultar ${baseUrl}:`, error.message);
        }
        return [];
    });

    // Aguarda os streams e a checagem do OpenSubtitles simultaneamente
    const [results, subInfo] = await Promise.all([
        Promise.allSettled(fetchStreamsPromises),
        fetchSubsPromise
    ]);

    let aggregatedStreams = [];
    for (const res of results) {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
            aggregatedStreams = aggregatedStreams.concat(res.value);
        }
    }

    if (aggregatedStreams.length === 0) {
        return { streams: [] };
    }

    const filteredStreams = [];
    for (const stream of aggregatedStreams) {
        const resolution = detectResolution(stream);
        
        if (!isResolutionAllowed(resolution, config)) {
            continue;
        }

        const formattedStream = {
            ...stream,
            name: formatStreamName(stream, resolution, subInfo.hasPt, config)
        };

        filteredStreams.push(formattedStream);
    }

    // Ordenação por qualidade/resolução
    filteredStreams.sort((a, b) => {
        const resA = detectResolution(a);
        const resB = detectResolution(b);
        return (RESOLUTION_PRIORITY[resA] || 99) - (RESOLUTION_PRIORITY[resB] || 99);
    });

    console.log(`[Stream Request] Retornando ${filteredStreams.length} streams formatados.`);
    return { streams: filteredStreams };
});

// HTML moderno, responsivo e com guia visual premium para o /configure
const configureHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Show Subtitle PT-BR - Configuração & Guia</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: radial-gradient(circle at 50% 0%, #170d2c 0%, #080512 100%);
            color: #f1ecf9;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            overflow-x: hidden;
        }
        .wrapper {
            width: 100%;
            max-width: 1000px;
            z-index: 2;
        }
        .hero {
            text-align: center;
            margin-bottom: 40px;
        }
        .hero-title {
            font-family: 'Outfit', sans-serif;
            font-size: 42px;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff 0%, #a274ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
            letter-spacing: -1px;
        }
        .hero-subtitle {
            font-size: 16px;
            color: #b0a3c7;
            max-width: 650px;
            margin: 0 auto 24px auto;
            line-height: 1.6;
        }
        .badges {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
        }
        .badge {
            background: rgba(162, 116, 255, 0.12);
            border: 1px solid rgba(162, 116, 255, 0.3);
            color: #d1baff;
            padding: 8px 16px;
            border-radius: 30px;
            font-size: 13px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 32px;
            margin-bottom: 30px;
        }
        @media (max-width: 900px) {
            .grid { grid-template-columns: 1fr; }
            .hero-title { font-size: 32px; }
        }
        .card {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            padding: 32px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            transition: transform 0.3s ease, border-color 0.3s ease;
        }
        .card:hover {
            border-color: rgba(162, 116, 255, 0.25);
        }
        .card-header {
            display: flex;
            align-items: center;
            gap: 14px;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            padding-bottom: 16px;
        }
        .card-icon {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #a274ff 0%, #683cd4 100%);
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 4px 18px rgba(162, 116, 255, 0.35);
        }
        .card-title {
            font-family: 'Outfit', sans-serif;
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
        }
        .form-group {
            margin-bottom: 24px;
        }
        label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #c9bada;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        select, textarea {
            width: 100%;
            padding: 14px 16px;
            background: rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            transition: all 0.25s ease;
        }
        select:focus, textarea:focus {
            border-color: #a274ff;
            box-shadow: 0 0 16px rgba(162, 116, 255, 0.35);
            background: rgba(0, 0, 0, 0.6);
        }
        select option { background: #0c081a; color: #fff; }
        textarea { resize: vertical; min-height: 80px; font-family: monospace; font-size: 12px; line-height: 1.5; }
        .hint { font-size: 12px; color: #8e80a5; margin-top: 6px; }
        
        .btn-primary {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #a274ff 0%, #683cd4 100%);
            border: none;
            border-radius: 14px;
            color: #ffffff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(162, 116, 255, 0.4);
            transition: all 0.25s ease;
            margin-top: 8px;
            font-family: 'Outfit', sans-serif;
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 32px rgba(162, 116, 255, 0.6);
        }
        .btn-secondary {
            width: 100%;
            padding: 14px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            color: #d1baff;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 12px;
            transition: all 0.2s ease;
        }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        
        .legend-title {
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .legend-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: rgba(0, 0, 0, 0.2);
            padding: 16px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            margin-bottom: 24px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 13px;
        }
        .legend-icon {
            font-size: 18px;
            min-width: 32px;
            text-align: center;
            background: rgba(255, 255, 255, 0.06);
            padding: 4px;
            border-radius: 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .legend-text { color: #d1ccdc; }
        .legend-text strong { color: #fff; }

        .step-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .step-item {
            display: flex;
            gap: 14px;
            background: rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.05);
            padding: 14px;
            border-radius: 14px;
            align-items: flex-start;
        }
        .step-number {
            width: 28px;
            height: 28px;
            min-width: 28px;
            background: rgba(162, 116, 255, 0.2);
            border: 1px solid #a274ff;
            color: #e3d3ff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
        }
        .step-text h4 {
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 4px;
        }
        .step-text p {
            font-size: 12.5px;
            color: #a49cb5;
            line-height: 1.5;
        }
        .highlight {
            color: #d1baff;
            font-weight: 600;
        }
        
        .preview-box {
            background: rgba(162, 116, 255, 0.05);
            border: 1px dashed rgba(162, 116, 255, 0.3);
            border-radius: 12px;
            padding: 14px;
            margin-top: 18px;
            text-align: center;
            font-size: 12px;
            color: #d1baff;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            font-size: 13px;
            color: #726786;
        }
        .footer a { color: #a274ff; text-decoration: none; font-weight: 600; }
        .footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="hero">
            <h1 class="hero-title">🎬 Show Subtitle PT-BR</h1>
            <p class="hero-subtitle">Descubra instantaneamente se as fontes de torrent no Stremio possuem legendas em Português ou áudio dublado.</p>
            <div class="badges">
                <span class="badge">💬 OpenSubtitles v3</span>
                <span class="badge">🔊 Detecção de Dublado</span>
                <span class="badge">⚡ Rápido & Sem Latência</span>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <div class="card-icon">⚙️</div>
                    <div class="card-title">Configurar Addon</div>
                </div>

                <form id="configForm">
                    <div class="form-group">
                        <label for="resolution">Filtro de Resolução</label>
                        <select id="resolution" name="resolution">
                            <option value="all" selected>Todas as Resoluções (All)</option>
                            <option value="4k">Apenas 4K (2160p)</option>
                            <option value="1080p">Apenas 1080p (Full HD)</option>
                            <option value="720p">Apenas 720p (HD)</option>
                            <option value="480p">Apenas 480p (SD)</option>
                            <option value="1080p_above">1080p e 4K (Full HD & 4K)</option>
                            <option value="720p_above">720p ou superior (720p, 1080p, 4K)</option>
                        </select>
                        <div class="hint">Filtre quais resoluções deseja que apareçam no Stremio.</div>
                    </div>

                    <div class="form-group">
                        <label for="upstreamUrls">Addons de Origem (Upstream)</label>
                        <textarea id="upstreamUrls" name="upstreamUrls">https://torrentio.strem.fun, https://torrentio.strem.fun/lite, https://torrentio.strem.fun/brazuca</textarea>
                        <div class="hint">URLs dos addons de torrent que fornecem os links (separados por vírgula).</div>
                    </div>

                    <div class="legend-title">Legenda de Ícones no Stremio:</div>
                    <div class="legend-list">
                        <div class="legend-item">
                            <span class="legend-icon">🔊💬</span>
                            <span class="legend-text"><strong>Áudio e Legenda</strong> em Português disponíveis</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-icon">🔊</span>
                            <span class="legend-text"><strong>Áudio Dublado</strong> em Português (sem legenda externa)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-icon">💬</span>
                            <span class="legend-text"><strong>Legenda em Português</strong> disponível no OpenSubtitles</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-icon">❌</span>
                            <span class="legend-text">Nenhuma opção de idioma PT-BR encontrada</span>
                        </div>
                    </div>

                    <button type="button" id="installBtn" class="btn-primary">🚀 INSTALAR NO STREMIO</button>
                    <button type="button" id="copyBtn" class="btn-secondary">📋 Copiar Link do Manifesto</button>
                </form>
            </div>

            <div class="card">
                <div class="card-header">
                    <div class="card-icon">📖</div>
                    <div class="card-title">Como Funciona</div>
                </div>

                <div class="step-list">
                    <div class="step-item">
                        <div class="step-number">1</div>
                        <div class="step-text">
                            <h4>Paralelismo Inteligente</h4>
                            <p>Ao abrir um filme ou série, o addon faz requisições paralelas para buscar as fontes de vídeo e checar a lista de legendas no <span class="highlight">OpenSubtitles v3</span>.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-number">2</div>
                        <div class="step-text">
                            <h4>Indicadores no Nome</h4>
                            <p>Os ícones <span class="highlight">🔊 (Áudio)</span> e <span class="highlight">💬 (Legenda)</span> são inseridos diretamente no nome do stream de forma dinâmica.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-number">3</div>
                        <div class="step-text">
                            <h4>Organizado no Topo</h4>
                            <p>O addon usa o prefixo <span class="highlight">!</span> para que todos os links processados fiquem ordenados no topo da tela de fontes do Stremio.</p>
                        </div>
                    </div>

                    <div class="step-item">
                        <div class="step-number">4</div>
                        <div class="step-text">
                            <h4>Pronto para Nuvem</h4>
                            <p>Este addon está 100% otimizado para rodar de forma serverless na <span class="highlight">Vercel</span> ou no <span class="highlight">Render</span> de graça e com alta velocidade.</p>
                        </div>
                    </div>
                </div>

                <div class="preview-box">
                    💡 <strong>Para Smart TV (LG/Samsung):</strong> Configure, copie o link do manifesto acima, vá na tela de Addons da sua TV e cole a URL!
                </div>
            </div>
        </div>

        <div class="footer">
            Show Subtitle PT-BR Addon • Código aberto no <a href="https://github.com/danielgoqueiroz/stremio-show-subtitle-pt-br" id="githubLink" target="_blank">GitHub</a>
        </div>
    </div>

    <script>
        function getManifestUrl() {
            const form = document.getElementById('configForm');
            const resolution = form.resolution.value;
            const upstreamUrls = form.upstreamUrls.value;

            const config = {
                resolution: resolution,
                upstreamUrls: upstreamUrls
            };

            const configPath = encodeURIComponent(JSON.stringify(config));
            return window.location.origin + '/' + configPath + '/manifest.json';
        }

        document.getElementById('installBtn').onclick = () => {
            const manifestUrl = getManifestUrl();
            const installUrl = manifestUrl.replace('https://', 'stremio://').replace('http://', 'stremio://');
            window.location.href = installUrl;
        };

        document.getElementById('copyBtn').onclick = () => {
            const manifestUrl = getManifestUrl();
            navigator.clipboard.writeText(manifestUrl).then(() => {
                const copyBtn = document.getElementById('copyBtn');
                copyBtn.innerText = '✅ Link do Manifesto Copiado!';
                setTimeout(() => {
                    copyBtn.innerText = '📋 Copiar Link do Manifesto';
                }, 3000);
            }).catch(err => {
                alert('URL do Manifesto: ' + manifestUrl);
            });
        };
    </script>
</body>
</html>`;

// Cria a aplicação Express
const app = express();

// Middleware Global de CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Rota customizada para entregar o manifesto dinâmico ordenado em 1º LUGAR no menu do Stremio
app.get("/:config/manifest.json", (req, res, next) => {
    try {
        const config = JSON.parse(req.params.config);
        const resLabel = getResolutionLabel(config.resolution);
        const dynamicManifest = {
            ...manifest,
            name: `Show Subtitle PT-BR (${resLabel})`
        };
        if (dynamicManifest.behaviorHints) {
            delete dynamicManifest.behaviorHints.configurable;
            delete dynamicManifest.behaviorHints.configurationRequired;
        }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        return res.json(dynamicManifest);
    } catch (e) {
        return next();
    }
});

// Serve a página de configuração customizada no / e no /configure
app.get(["/", "/configure"], (req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(configureHTML);
});

// Conecta as rotas padrão do Stremio Addon SDK (/manifest.json, /stream/..., etc.)
app.use(getRouter(builder.getInterface()));

// Porta dinâmica (exigida por hospedagens em nuvem como Vercel, Beamup, Render)
const PORT = process.env.PORT || process.env.PORT_ADDON || 7000;

app.listen(PORT, () => {
    console.log(`Addon Show Subtitle PT-BR rodando na porta ${PORT}`);
    console.log(`Página de Configuração: http://localhost:${PORT}/configure`);
    console.log(`Manifesto Stremio: http://localhost:${PORT}/manifest.json`);
});

export default app;
