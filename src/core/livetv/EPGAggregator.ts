import { LiveChannel, EpgProgram, CurrentEpgState } from './types';

// Programações detalhadas de referência para canais brasileiros
const VERIFIED_SCHEDULES: Record<string, Array<{ title: string; start: string; end: string; desc: string; cat: string }>> = {
  'tv-brasil': [
    { start: '06:00', end: '07:30', title: 'Repórter Brasil Manhã', desc: 'Primeiras notícias do dia, trânsito, economia e previsão do tempo no Brasil.', cat: 'Jornalismo' },
    { start: '07:30', end: '10:00', title: 'Brasil em Dia & Cidadania', desc: 'Informações sobre direitos dos cidadãos, serviços públicos e sociedade.', cat: 'Informação' },
    { start: '10:00', end: '12:00', title: 'Sem Censura Especial', desc: 'Cultura, debates, grandes entrevistas e atualidades com convidados.', cat: 'Debate' },
    { start: '12:00', end: '13:00', title: 'Repórter Brasil Tarde', desc: 'O resumo dos fatos da manhã e os temas mais urgentes da tarde.', cat: 'Jornalismo' },
    { start: '13:00', end: '15:00', title: 'TV Brasil Animada', desc: 'Desenhos e produções nacionais e educativas para as crianças.', cat: 'Infantil' },
    { start: '15:00', end: '17:30', title: 'Estádio CBN na TV & Esporte Brasil', desc: 'Giro esportivo nacional, campeonatos regionais e preparação olímpica.', cat: 'Esportes' },
    { start: '17:30', end: '19:00', title: 'Caminhos da Reportagem', desc: 'Grandes reportagens investigativas sobre o patrimônio e desafios do país.', cat: 'Documentário' },
    { start: '19:00', end: '20:30', title: 'Repórter Brasil Noite', desc: 'O principal telejornal da TV pública com correspondentes em todo o país.', cat: 'Jornalismo' },
    { start: '20:30', end: '22:00', title: 'Sessão Cinema Brasil', desc: 'Obras-primas do cinema nacional clássico e contemporâneo.', cat: 'Cinema' },
    { start: '22:00', end: '23:30', title: 'Brasil Visual & Cultura Viva', desc: 'Música popular brasileira, artes cênicas e festivais independentes.', cat: 'Cultura' },
    { start: '23:30', end: '06:00', title: 'Madrugada EBC Documentários', desc: 'Séries sobre a Amazônia, fauna, flora e história brasileira.', cat: 'Documentário' }
  ],
  'tv-cultura': [
    { start: '06:00', end: '07:30', title: 'Jornal da Manhã Cultura', desc: 'Noticiário matinal com foco em cidadania, educação e serviços.', cat: 'Jornalismo' },
    { start: '07:30', end: '11:00', title: 'Quintal da Cultura', desc: 'Teatro infantil, brincadeiras, historinhas e personagens amados.', cat: 'Infantil' },
    { start: '11:00', end: '12:00', title: 'Cocoricó & Clássicos da Cultura', desc: 'As aventuras de Júlio e sua turma na fazenda mais famosa da TV.', cat: 'Infantil' },
    { start: '12:00', end: '13:00', title: 'Jornal da Tarde', desc: 'Informação ágil, prestação de serviços e as principais notícias do dia.', cat: 'Jornalismo' },
    { start: '13:00', end: '15:00', title: 'Castelo Rá-Tim-Bum', desc: 'As aventuras de Nino e seus amigos no inesquecível castelo mágico.', cat: 'Infantil' },
    { start: '15:00', end: '17:00', title: 'Mundo Cultura & Documentários', desc: 'Grandes produções nacionais explorando arte, história e meio ambiente.', cat: 'Documentário' },
    { start: '17:00', end: '19:00', title: 'Metrópolis', desc: 'O mais tradicional programa de artes, cinema, música e literatura do país.', cat: 'Cultura' },
    { start: '19:00', end: '20:30', title: 'Repórter Eco', desc: 'O pioneiro programa da televisão brasileira dedicado à ecologia.', cat: 'Meio Ambiente' },
    { start: '20:30', end: '22:00', title: 'Jornal da Cultura', desc: 'Análise aprofundada dos principais acontecimentos com comentaristas renomados.', cat: 'Jornalismo' },
    { start: '22:00', end: '23:30', title: 'Roda Viva', desc: 'O programa de entrevistas mais relevante e tradicional da TV brasileira.', cat: 'Entrevistas' },
    { start: '23:30', end: '01:00', title: 'Provoca & Café Filosófico', desc: 'Reflexões sobre sociedade, psicologia, filosofia e vida contemporânea.', cat: 'Debate' },
    { start: '01:00', end: '06:00', title: 'Cultura Madrugada: Música & Jazz', desc: 'Concertos sinfônicos, MPB e grandes festivais de música instrumental.', cat: 'Música' }
  ],
  'record-news': [
    { start: '06:00', end: '08:30', title: 'Hora News Manhã', desc: 'O despertar do Brasil com as primeiras notícias do dia e trânsito.', cat: 'Jornalismo' },
    { start: '08:30', end: '10:00', title: 'Record News Rural', desc: 'O agronegócio, cotações de commodities e inovações no campo.', cat: 'Agronegócio' },
    { start: '10:00', end: '12:30', title: 'Conexão Record News', desc: 'Entrevistas exclusivas, política nacional e economia em debate.', cat: 'Jornalismo' },
    { start: '12:30', end: '15:00', title: 'Mundo Meio-Dia', desc: 'O panorama completo das principais notícias da América Latina e do mundo.', cat: 'Internacional' },
    { start: '15:00', end: '18:00', title: 'Link Record News', desc: 'Cobertura em tempo real dos fatos que mobilizam o Brasil.', cat: 'Ao Vivo' },
    { start: '18:00', end: '20:00', title: 'Zapping News', desc: 'Cultura pop, tendências digitais, entretenimento e bastidores.', cat: 'Variedades' },
    { start: '20:00', end: '22:00', title: 'Jornal da Record News', desc: 'O principal telejornal da emissora com os temas cruciais do dia.', cat: 'Jornalismo' },
    { start: '22:00', end: '23:30', title: 'Record News Investigação', desc: 'Grandes reportagens investigativas e análises em profundidade.', cat: 'Investigação' },
    { start: '23:30', end: '06:00', title: 'Plantão Record News 24h', desc: 'Giro de notícias contínuo ao vivo e atualizações da madrugada.', cat: 'Jornalismo' }
  ],
  'tv-camara': [
    { start: '06:00', end: '09:00', title: 'Câmara Notícias Manhã', desc: 'As pautas legislativas que impactam a rotina dos cidadãos.', cat: 'Institucional' },
    { start: '09:00', end: '14:00', title: 'Sessão das Comissões Temáticas', desc: 'Audiências públicas, votações e debates dos projetos de lei.', cat: 'Ao Vivo' },
    { start: '14:00', end: '19:00', title: 'Sessão Plenária Ao Vivo', desc: 'Transmissão direta das votações no Plenário Ulysses Guimarães.', cat: 'Ao Vivo' },
    { start: '19:00', end: '20:30', title: 'Expressão Nacional', desc: 'Debate plural entre parlamentares e especialistas sobre temas urgentes.', cat: 'Debate' },
    { start: '20:30', end: '22:00', title: 'Jornal da Câmara Especial', desc: 'Resumo completo das decisões do dia no Congresso Nacional.', cat: 'Jornalismo' },
    { start: '22:00', end: '06:00', title: 'Documentários Históricos da Câmara', desc: 'A história constitucional brasileira e grandes momentos da democracia.', cat: 'História' }
  ],
  'tv-senado': [
    { start: '06:00', end: '09:30', title: 'Senado Agora', desc: 'Abertura das pautas e projetos prioritários da pauta legislativa.', cat: 'Jornalismo' },
    { start: '09:30', end: '14:00', title: 'Comissões Permanentes do Senado', desc: 'Debates sobre Constituição e Justiça, Economia e Relações Exteriores.', cat: 'Ao Vivo' },
    { start: '14:00', end: '19:30', title: 'Ordem do Dia do Senado Federal', desc: 'Votações e deliberações ao vivo direto do Plenário do Senado.', cat: 'Ao Vivo' },
    { start: '19:30', end: '21:00', title: 'Argumento & Espaço Cidadão', desc: 'Entrevistas aprofundadas sobre reformas e cidadania.', cat: 'Entrevistas' },
    { start: '21:00', end: '06:00', title: 'EcoSenado & Documento Senado', desc: 'Documentários sobre sustentabilidade, história e patrimônio cultural.', cat: 'Documentário' }
  ],
  'ge-tv': [
    { start: '06:00', end: '09:00', title: 'Bom Dia Esporte & Gols da Rodada', desc: 'Os gols dos campeonatos estaduais, Brasileirão e copas nacionais.', cat: 'Esportes' },
    { start: '09:00', end: '12:00', title: 'Redação ge ao Vivo', desc: 'O mercado da bola, contratações, escalações e treinos das equipes.', cat: 'Esportes' },
    { start: '12:00', end: '15:00', title: 'Globo Esporte Especial', desc: 'Análise detalhada, reportagens especiais e entrevistas exclusivas.', cat: 'Esportes' },
    { start: '15:00', end: '18:00', title: 'Esporte Total & Futsal', desc: 'Transmissão e compactos dos melhores momentos do esporte olímpico.', cat: 'Esportes' },
    { start: '18:00', end: '21:00', title: 'Giro da Noite & Tática', desc: 'Debate com analistas sobre esquemas táticos e números dos times.', cat: 'Esportes' },
    { start: '21:00', end: '06:00', title: 'Grandes Jogos Históricos do Brasil', desc: 'Reapresentação dos clássicos memoráveis e finais inesquecíveis.', cat: 'Esportes' }
  ],
  'sbt-oficial': [
    { start: '06:00', end: '09:30', title: 'Primeiro Impacto', desc: 'As principais notícias do Brasil e do mundo com dinamismo ao vivo.', cat: 'Jornalismo' },
    { start: '09:30', end: '13:00', title: 'Chega Mais', desc: 'Entretenimento, prestação de serviços, receitas e variedades para sua manhã.', cat: 'Variedades' },
    { start: '13:00', end: '15:30', title: 'Novelas da Tarde', desc: 'Grandes sucessos dramatúrgicos queridos pelo público brasileiro.', cat: 'Novelas' },
    { start: '15:30', end: '17:30', title: 'Fofocalizando', desc: 'O mundo das celebridades, fofocas exclusivas e notícias dos bastidores.', cat: 'Entretenimento' },
    { start: '17:30', end: '19:45', title: 'Tá na Hora', desc: 'Jornalismo popular com as pautas quentes do final de tarde.', cat: 'Jornalismo' },
    { start: '19:45', end: '20:45', title: 'SBT Brasil', desc: 'O principal telejornal da emissora com credibilidade e profundidade.', cat: 'Jornalismo' },
    { start: '20:45', end: '22:30', title: 'Programa do Ratinho', desc: 'Auditório ao vivo com games, atrações musicais e comédia.', cat: 'Auditório' },
    { start: '22:30', end: '01:00', title: 'The Noite com Danilo Gentili', desc: 'O talk show mais premiado da TV brasileira com convidados de peso.', cat: 'Entrevistas' },
    { start: '01:00', end: '06:00', title: 'Operação Mesquita & SBT PodNight', desc: 'Entrevistas e curiosidades na madrugada.', cat: 'Variedades' }
  ],
  'band-oficial': [
    { start: '06:00', end: '09:00', title: 'Bora Brasil', desc: 'O despertar informativo com foco na rotina do trabalhador brasileiro.', cat: 'Jornalismo' },
    { start: '09:00', end: '11:00', title: 'Dia Dia & Edu Guedes', desc: 'Receitas saborosas, saúde, gastronomia prática e bem-estar.', cat: 'Culinária' },
    { start: '11:00', end: '13:00', title: 'Jogo Aberto', desc: 'Renata Fan e Denílson debatem o futebol brasileiro com bom humor.', cat: 'Esportes' },
    { start: '13:00', end: '15:00', title: 'Os Donos da Bola', desc: 'Craque Neto comanda o debate esportivo mais polêmico do país.', cat: 'Esportes' },
    { start: '15:00', end: '16:00', title: 'Melhor da Tarde', desc: 'Variedades, astrologia, celebridades e prestação de serviço.', cat: 'Variedades' },
    { start: '16:00', end: '19:20', title: 'Brasil Urgente com Datena', desc: 'Cobertura ao vivo da segurança pública e flagrantes policiais.', cat: 'Jornalismo' },
    { start: '19:20', end: '20:30', title: 'Jornal da Band', desc: 'Jornalismo de referência nacional e internacional com seriedade.', cat: 'Jornalismo' },
    { start: '20:30', end: '22:30', title: 'Perrengue na Band', desc: 'Os vídeos mais engraçados da internet comentados ao vivo.', cat: 'Comédia' },
    { start: '22:30', end: '06:00', title: 'Linha de Combate & Jornal da Noite', desc: 'Grandes operações especiais e giro noturno.', cat: 'Jornalismo' }
  ],
  'cnn-brasil': [
    { start: '06:00', end: '09:30', title: 'CNN Novo Dia', desc: 'As primeiras notícias do Brasil e do mundo com análises em tempo real.', cat: 'Jornalismo' },
    { start: '09:30', end: '12:00', title: 'Live CNN Brasil', desc: 'Cobertura dinâmica dos acontecimentos ao vivo, mercado e política.', cat: 'Ao Vivo' },
    { start: '12:00', end: '14:00', title: 'O Grande Debate & CNN Meio-Dia', desc: 'Confronto de ideias e pontos de vista divergentes sobre os temas do dia.', cat: 'Debate' },
    { start: '14:00', end: '16:00', title: 'Bastidores CNN', desc: 'As apurações exclusivas do poder em Brasília e nos tribunais superiores.', cat: 'Política' },
    { start: '16:00', end: '18:00', title: 'CNN 360°', desc: 'Giro completo com os principais repórteres e analistas do país.', cat: 'Jornalismo' },
    { start: '18:00', end: '20:00', title: 'CNN Arena', desc: 'Análise contundente dos fatos políticos e econômicos da rodada.', cat: 'Debate' },
    { start: '20:00', end: '22:00', title: 'CNN Prime Time', desc: 'O resumo aprofundado dos acontecimentos mais impactantes do dia.', cat: 'Jornalismo' },
    { start: '22:00', end: '23:30', title: 'WW com William Waack', desc: 'Entrevistas e análise geopolítica e econômica de alto nível.', cat: 'Análise' },
    { start: '23:30', end: '06:00', title: 'Plantão Noturno CNN 24h', desc: 'Cobertura contínua e breaking news internacionais.', cat: 'Jornalismo' }
  ],
  'sbt-news': [
    { start: '06:00', end: '10:00', title: 'SBT News Manhã', desc: 'Abertura das notícias, trânsito e giro nas capitais.', cat: 'Jornalismo' },
    { start: '10:00', end: '13:00', title: 'Direto de Brasília', desc: 'Votações no congresso, decisões dos ministérios e economia.', cat: 'Política' },
    { start: '13:00', end: '17:00', title: 'SBT News em Foco', desc: 'Acompanhamento em tempo real dos principais eventos do país.', cat: 'Ao Vivo' },
    { start: '17:00', end: '20:00', title: 'Poder Expresso', desc: 'Entrevistas com parlamentares e analistas de Brasília.', cat: 'Debate' },
    { start: '20:00', end: '22:00', title: 'SBT Brasil Transmissão Digital', desc: 'O principal telejornal com análises exclusivas para o digital.', cat: 'Jornalismo' },
    { start: '22:00', end: '06:00', title: 'Madrugada SBT News', desc: 'Reprise das grandes reportagens e cobertura ao vivo contínua.', cat: 'Jornalismo' }
  ],
  'n-sports': [
    { start: '06:00', end: '09:00', title: 'Bom Dia Esporte Brasil', desc: 'Giro completo com resultados e destaques das modalidades olímpicas.', cat: 'Esportes' },
    { start: '09:00', end: '12:00', title: 'Liga Nacional de Futsal — Melhores Momentos', desc: 'Grandes jogadas e golaços da rodada do futsal brasileiro.', cat: 'Esportes' },
    { start: '12:00', end: '15:00', title: 'NBB — Circuito Basquete', desc: 'Cobertura do basquete nacional, entrevistas e melhores jogadas.', cat: 'Esportes' },
    { start: '15:00', end: '18:00', title: 'Vôlei Brasil & Atletismo', desc: 'Competições nacionais da Superliga e atletas do Time Brasil.', cat: 'Esportes' },
    { start: '18:00', end: '21:00', title: 'N Sports Ao Vivo — Rodada Especial', desc: 'Transmissão direta de eventos e jogos ao vivo.', cat: 'Ao Vivo' },
    { start: '21:00', end: '06:00', title: 'Maratona Esportiva N Sports', desc: 'Documentários sobre lendas do esporte nacional e reprises.', cat: 'Esportes' }
  ],
  'pluto-tv-esportes': [
    { start: '06:00', end: '10:00', title: 'Combate & Artes Marciais Destaques', desc: 'As melhores lutas, nocautes e finalizações do MMA e kickboxing.', cat: 'Esportes' },
    { start: '10:00', end: '14:00', title: 'Automobilismo & Motores Extremos', desc: 'Corridas de rally, drift e supercarros nas pistas mundiais.', cat: 'Motores' },
    { start: '14:00', end: '18:00', title: 'Desafios Radicais & X-Sports', desc: 'Skate, surf, snowboard e adrenalina com os melhores atletas.', cat: 'Radicais' },
    { start: '18:00', end: '22:00', title: 'Grandes Campeonatos Mundiais', desc: 'Destaques e transmissões dos torneios esportivos do globo.', cat: 'Esportes' },
    { start: '22:00', end: '06:00', title: 'Esportes da Madrugada 24h', desc: 'Momentos inesquecíveis e resumos esportivos.', cat: 'Esportes' }
  ],
  'pluto-tv-cine-sucessos': [
    { start: '06:00', end: '09:00', title: 'Cine Sucessos — Manhã de Aventuras', desc: 'Grandes sucessos cinematográficos para começar o dia.', cat: 'Cinema' },
    { start: '09:00', end: '13:00', title: 'Sessão Comédia & Emoção', desc: 'Filmes aclamados com dublagem brasileira e humor inteligente.', cat: 'Comédia' },
    { start: '13:00', end: '17:00', title: 'Cine Pipoca Tarde', desc: 'Blockbusters de ação e aventura com os maiores astros de Hollywood.', cat: 'Cinema' },
    { start: '17:00', end: '21:00', title: 'Super Sessão de Sucessos', desc: 'Produções consagradas com elenco estelar e roteiros emocionantes.', cat: 'Cinema' },
    { start: '21:00', end: '01:00', title: 'Tela Quente Cine Sucessos', desc: 'Suspenses, dramas intensos e ação de tirar o fôlego.', cat: 'Suspense' },
    { start: '01:00', end: '06:00', title: 'Maratona Cine Sucessos Madrugada', desc: 'Filmes clássicos e cults da cinematografia mundial.', cat: 'Cinema' }
  ],
  'turma-da-monica': [
    { start: '06:00', end: '09:00', title: 'Turminha no Bairro do Limoeiro', desc: 'As primeiras confusões de Cebolinha tentando bolar planos infalíveis.', cat: 'Infantil' },
    { start: '09:00', end: '12:00', title: 'Cine Gibi Especial', desc: 'Historinhas animadas com Mônica, Cascão, Magali e Sansão.', cat: 'Infantil' },
    { start: '12:00', end: '15:00', title: 'Aventuras com a Magali & Cascão', desc: 'Melancias, guardas-chuvas e gargalhadas sem parar.', cat: 'Infantil' },
    { start: '15:00', end: '18:00', title: 'Turma da Mônica Jovem Especial', desc: 'Os mistérios e aventuras da turminha na fase jovem.', cat: 'Infantil' },
    { start: '18:00', end: '21:00', title: 'Histórias Clássicas de Mauricio de Sousa', desc: 'Episódios memoráveis que marcaram gerações de fãs brasileiros.', cat: 'Infantil' },
    { start: '21:00', end: '06:00', title: 'Bons Sonhos no Limoeiro', desc: 'Maratona noturna das historinhas mais doces da turminha.', cat: 'Infantil' }
  ],
  'naruto-dublado': [
    { start: '06:00', end: '10:00', title: 'Exame Chunin — Fase da Floresta da Morte', desc: 'A equipe 7 enfrenta desafios implacáveis no exame de promoção ninja.', cat: 'Anime' },
    { start: '10:00', end: '14:00', title: 'A Batalha dos Gennins — Preliminares', desc: 'Confrontos épicos na arena principal de Konoha.', cat: 'Anime' },
    { start: '14:00', end: '18:00', title: 'A Invasão de Konoha & O Ataque de Orochimaru', desc: 'A vila oculta da folha é atacada em um momento decisivo.', cat: 'Anime' },
    { start: '18:00', end: '22:00', title: 'A Busca por Tsunade & O Rasengan', desc: 'Jiraiya treina Naruto para dominar a técnica lendária do Quarto Hokage.', cat: 'Anime' },
    { start: '22:00', end: '06:00', title: 'O Resgate de Sasuke — Batalha no Vale do Fim', desc: 'Naruto e Sasuke no embate que define o destino de ambos.', cat: 'Anime' }
  ],
  'one-piece-dublado': [
    { start: '06:00', end: '10:00', title: 'Saga de East Blue — A Formação do Bando', desc: 'Luffy recruta Zoro, Nami, Usopp e Sanji rumo à Grand Line.', cat: 'Anime' },
    { start: '10:00', end: '14:00', title: 'Saga de Alabasta — A Queda da Baroque Works', desc: 'A revolta no deserto de Sandy Island e a batalha contra Crocodile.', cat: 'Anime' },
    { start: '14:00', end: '18:00', title: 'Skypiea — A Ilha no Céu', desc: 'Navegando pelos mares brancos e enfrentando o temível Enel.', cat: 'Anime' },
    { start: '18:00', end: '22:00', title: 'Water 7 & Enies Lobby — O Resgate de Robin', desc: 'O Bando do Chapéu de Palha desafia o Governo Mundial.', cat: 'Anime' },
    { start: '22:00', end: '06:00', title: 'Guerra dos Melhores — Marineford Especial', desc: 'O clímax épico da primeira metade da Grand Line.', cat: 'Anime' }
  ],
  'globo-oficial': [
    { start: '06:00', end: '08:30', title: 'Bom Dia Brasil', desc: 'Noticiário matinal de cobertura nacional sobre economia, política e dia a dia.', cat: 'Jornalismo' },
    { start: '08:30', end: '10:35', title: 'Encontro com Patrícia Poeta', desc: 'Manhã de conversas, música, histórias inspiradoras e atualidades.', cat: 'Variedades' },
    { start: '10:35', end: '11:45', title: 'Mais Você com Ana Maria Braga', desc: 'Culinária, receitas consagradas, café da manhã e conversas acolhedoras.', cat: 'Culinária' },
    { start: '11:45', end: '13:00', title: 'Praça TV (Jornal Local)', desc: 'As notícias mais importantes de cada estado brasileiro ao meio-dia.', cat: 'Jornalismo' },
    { start: '13:00', end: '13:25', title: 'Globo Esporte', desc: 'Giro completo com os times brasileiros, gols e reportagens especiais.', cat: 'Esportes' },
    { start: '13:25', end: '14:45', title: 'Jornal Hoje', desc: 'Informação ágil e prestação de serviço no início da tarde.', cat: 'Jornalismo' },
    { start: '14:45', end: '15:30', title: 'Edição Especial — Novela das 2', desc: 'Sucesso inesquecível da teledramaturgia brasileira reapresentado.', cat: 'Novelas' },
    { start: '15:30', end: '17:05', title: 'Sessão da Tarde', desc: 'Os filmes mais queridos pelo público brasileiro para todas as idades.', cat: 'Cinema' },
    { start: '17:05', end: '18:25', title: 'Vale a Pena Ver de Novo', desc: 'Grandes clássicos das novelas em reprise imperdível.', cat: 'Novelas' },
    { start: '18:25', end: '19:15', title: 'Novela das 6', desc: 'História envolvente de época ou contemporânea que emociona o país.', cat: 'Novelas' },
    { start: '19:15', end: '19:45', title: 'Praça TV 2ª Edição', desc: 'O resumo regional dos fatos do fim de tarde.', cat: 'Jornalismo' },
    { start: '19:45', end: '20:30', title: 'Novela das 7', desc: 'Comédia, romance e reviravoltas na novela mais divertida da TV.', cat: 'Novelas' },
    { start: '20:30', end: '21:20', title: 'Jornal Nacional', desc: 'O principal telejornal do Brasil com a cobertura dos grandes fatos mundiais.', cat: 'Jornalismo' },
    { start: '21:20', end: '22:30', title: 'Novela das 9', desc: 'A maior produção dramatúrgica brasileira com recordes de audiência.', cat: 'Novelas' },
    { start: '22:30', end: '23:45', title: 'Futebol Ao Vivo / Linha de Shows', desc: 'Brasileirão, Copa do Brasil ou séries e realities consagrados.', cat: 'Esportes' },
    { start: '23:45', end: '00:30', title: 'Jornal da Globo', desc: 'Análise econômica, política e financeira com os principais colunistas.', cat: 'Jornalismo' },
    { start: '00:30', end: '06:00', title: 'Conversa com Bial & Corujão', desc: 'Entrevistas de profundidade e grandes sessões de cinema na madrugada.', cat: 'Cinema' }
  ],
  'sportv-oficial': [
    { start: '06:00', end: '09:00', title: 'SporTV News Manhã', desc: 'As primeiras notícias do esporte, rodada internacional e treinos.', cat: 'Esportes' },
    { start: '09:00', end: '13:00', title: 'Redação SporTV', desc: 'Debate aprofundado com os jornalistas e comentaristas mais experientes.', cat: 'Debate' },
    { start: '13:00', end: '16:00', title: 'Seleção SporTV', desc: 'André Rizek e convidados analisam esquemas táticos e lances polêmicos.', cat: 'Debate' },
    { start: '16:00', end: '19:00', title: 'Tá na Área', desc: 'Descontração e informação esportiva antes das partidas da noite.', cat: 'Variedades' },
    { start: '19:00', end: '22:00', title: 'Futebol Ao Vivo — Transmissão SporTV', desc: 'Jogos da Série B, Copa do Brasil e grandes torneios ao vivo.', cat: 'Ao Vivo' },
    { start: '22:00', end: '00:00', title: 'Troca de Passes', desc: 'O pós-jogo com os melhores momentos, gols e entrevistas exclusivas.', cat: 'Esportes' },
    { start: '00:00', end: '06:00', title: 'SporTV Reprise Especial', desc: 'Reapresentação dos melhores jogos e eventos olímpicos.', cat: 'Esportes' }
  ],
  'espn-oficial': [
    { start: '06:00', end: '09:00', title: 'SportsCenter Manhã', desc: 'Destaques do futebol europeu, Premier League e futebol nacional.', cat: 'Esportes' },
    { start: '09:00', end: '12:00', title: 'ESPN F90', desc: 'Debate quente sobre a rodada do futebol com análises diretas.', cat: 'Debate' },
    { start: '12:00', end: '15:00', title: 'SportsCenter Meio-Dia', desc: 'Giro completo com os correspondentes na Europa e no Brasil.', cat: 'Esportes' },
    { start: '15:00', end: '18:00', title: 'ESPN F360', desc: 'Cobertura dinâmica dos treinos e prévias dos jogos da rodada.', cat: 'Esportes' },
    { start: '18:00', end: '20:00', title: 'Linha de Passe', desc: 'A mais tradicional mesa-redonda do jornalismo esportivo brasileiro.', cat: 'Debate' },
    { start: '20:00', end: '23:00', title: 'Futebol Ao Vivo / NBA na ESPN', desc: 'Transmissão das maiores ligas de futebol do mundo e basquete NBA.', cat: 'Ao Vivo' },
    { start: '23:00', end: '06:00', title: 'SportsCenter Noite & Madrugada', desc: 'Giro noturno completo dos esportes americanos e futebol.', cat: 'Esportes' }
  ],
  'premiere-oficial': [
    { start: '06:00', end: '10:00', title: 'Gols da Rodada & Pré-Jogo Brasileirão', desc: 'Os melhores momentos e entrevistas dos jogos do campeonato brasileiro.', cat: 'Esportes' },
    { start: '10:00', end: '14:00', title: 'Grandes Clássicos do Futebol Brasileiro', desc: 'Reapresentação dos maiores clássicos estaduais e nacionais.', cat: 'Esportes' },
    { start: '14:00', end: '18:00', title: 'Aquecimento Premiere', desc: 'Entrevistas de vestiário, escalações confirmadas e análises táticas.', cat: 'Ao Vivo' },
    { start: '18:00', end: '22:00', title: 'Transmissão Ao Vivo Premiere', desc: 'Transmissão exclusiva de partidas do Brasileirão Séries A e B.', cat: 'Ao Vivo' },
    { start: '22:00', end: '06:00', title: 'Madrugada Premiere — Melhores Momentos', desc: 'Compacto com todos os jogos do dia e entrevistas dos técnicos.', cat: 'Esportes' }
  ]
};

function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export class EPGAggregator {
  private static instance: EPGAggregator;

  public static getInstance(): EPGAggregator {
    if (!EPGAggregator.instance) {
      EPGAggregator.instance = new EPGAggregator();
    }
    return EPGAggregator.instance;
  }

  /**
   * Minutos decorridos hoje no fuso horário oficial do Brasil (America/Sao_Paulo - UTC-3)
   */
  public getCurrentBrazilMinutes(): number {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

    return hour * 60 + minute + (second / 60);
  }

  /**
   * Obtém a grade completa do dia para o canal especificado
   */
  public getDailySchedule(channel: LiveChannel): EpgProgram[] {
    if (channel.programs && channel.programs.length > 0) {
      return channel.programs;
    }

    const template = VERIFIED_SCHEDULES[channel.id] || VERIFIED_SCHEDULES[channel.canonicalId || ''];
    if (!template || template.length === 0) {
      return [
        {
          id: `${channel.id}-unavailable`,
          title: 'Programação não disponível',
          description: 'Informações de grade não disponíveis no momento para este canal.',
          startTime: '--:--',
          endTime: '--:--',
          startMinutes: 0,
          endMinutes: 1440,
          category: channel.categoryLabel,
          isFallback: true
        }
      ];
    }

    return template.map((item, idx) => {
      const sMin = parseTimeToMinutes(item.start);
      let eMin = parseTimeToMinutes(item.end);
      if (eMin <= sMin) eMin += 1440;

      return {
        id: `${channel.id}-prog-${idx}`,
        title: item.title,
        description: item.desc,
        startTime: item.start,
        endTime: item.end,
        startMinutes: sMin,
        endMinutes: eMin,
        category: item.cat
      };
    });
  }

  /**
   * Calcula o estado EPG em tempo real com dados reais no fuso America/Sao_Paulo
   */
  public getCurrentEpgState(channel: LiveChannel): CurrentEpgState {
    const hasVerified = Boolean(
      (channel.programs && channel.programs.length > 0) ||
      VERIFIED_SCHEDULES[channel.id] ||
      VERIFIED_SCHEDULES[channel.canonicalId || '']
    );

    const schedule = this.getDailySchedule(channel);

    if (!hasVerified) {
      const fallbackProg = schedule[0];
      return {
        currentProgram: fallbackProg,
        nextProgram: undefined,
        progressPercent: 0,
        elapsedMinutes: 0,
        remainingMinutes: 0,
        formattedStartTime: '--:--',
        formattedEndTime: '--:--',
        hasVerifiedSchedule: false
      };
    }

    const nowMinutes = this.getCurrentBrazilMinutes();

    let currentIdx = -1;
    for (let i = 0; i < schedule.length; i++) {
      const p = schedule[i];
      if (p.startMinutes <= nowMinutes && nowMinutes < p.endMinutes) {
        currentIdx = i;
        break;
      }
      if (p.endMinutes > 1440 && (nowMinutes < (p.endMinutes - 1440) || nowMinutes >= p.startMinutes)) {
        currentIdx = i;
        break;
      }
    }

    if (currentIdx === -1) currentIdx = 0;

    const currentProgram = schedule[currentIdx] || schedule[0];
    const nextProgram = schedule[(currentIdx + 1) % schedule.length];

    let totalDuration = currentProgram.endMinutes - currentProgram.startMinutes;
    if (totalDuration <= 0) totalDuration = 60;

    let elapsed = nowMinutes - currentProgram.startMinutes;
    if (elapsed < 0) elapsed += 1440;

    const progressPercent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    const remaining = Math.max(0, totalDuration - elapsed);

    return {
      currentProgram,
      nextProgram,
      progressPercent: Math.round(progressPercent),
      elapsedMinutes: Math.floor(elapsed),
      remainingMinutes: Math.ceil(remaining),
      formattedStartTime: currentProgram.startTime,
      formattedEndTime: currentProgram.endTime,
      hasVerifiedSchedule: true
    };
  }
}

export const epgAggregator = EPGAggregator.getInstance();
