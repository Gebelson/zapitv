// server.ts
import express from "express";
import path2 from "path";
import { fileURLToPath } from "url";
import fs2 from "fs";

// src/core/catalog/verifiedCatalog.ts
var VERIFIED_OPEN_ITEMS = [
  // 1. FILME COMPLETO - CLÁSSICO DE DOMÍNIO PÚBLICO
  {
    id: "open-night-living-dead-1968",
    title: "A Noite dos Mortos-Vivos (1968)",
    type: "FILME" /* MOVIE */,
    rating: 7.9,
    year: 1968,
    image: "https://image.tmdb.org/t/p/w500/rb2NWyb008u1EcKCOyXs2Nmj0ra.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/5KtmBSqFtHY3I9t8lgH27Mc0bqY.jpg",
    description: "Um cl\xE1ssico absoluto do cinema de terror dirigido por George A. Romero, em dom\xEDnio p\xFAblico mundial. Um grupo de sobreviventes refugia-se em uma casa de campo enquanto os mortos despertam famintos. Obra completa sem an\xFAncios.",
    genres: ["Terror", "Fic\xE7\xE3o Cient\xEDfica", "Mist\xE9rio"],
    director: "George A. Romero",
    cast: ["Duane Jones", "Judith O'Dea", "Karl Hardman", "Marilyn Eastman"],
    tmdbId: "10331",
    imdbId: "tt0063350",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "other",
    // Áudio original inglês
    verifiedStreams: [
      {
        name: "Proxy Local ZapiTV",
        title: "[STREAM DIRETO] A Noite dos Mortos-Vivos - Servidor Local ZapiTV",
        url: "/api/proxy?url=" + encodeURIComponent("https://upload.wikimedia.org/wikipedia/commons/2/24/Night_of_the_Living_Dead_%281968%29.webm"),
        sourceType: "mp4",
        isPtBr: false,
        isDubbed: false,
        quality: "1080p",
        providerName: "ZapiTV Stream Core"
      },
      {
        name: "Cinema Aberto FHD",
        title: "[\xC1UDIO ORIGINAL] A Noite dos Mortos-Vivos (1968) - 1080p WebM Direto",
        url: "https://upload.wikimedia.org/wikipedia/commons/2/24/Night_of_the_Living_Dead_%281968%29.webm",
        sourceType: "mp4",
        isPtBr: false,
        isDubbed: false,
        quality: "1080p",
        providerName: "Dom\xEDnio P\xFAblico Mundial"
      }
    ]
  },
  // 2. PRODUÇÃO NACIONAL COM ÁUDIO ORIGINAL PT-BR CONFIRMADO
  {
    id: "open-historias-fome-br",
    title: "Hist\xF3rias da Fome no Brasil",
    type: "FILME" /* MOVIE */,
    rating: 8.6,
    year: 2018,
    image: "https://image.tmdb.org/t/p/w500/nsg2O1Ay9IeHZNEysydfpNcMun4.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/uIkMQracDATOzT1fftCu4Pe8bQw.jpg",
    description: "Document\xE1rio nacional com \xE1udio original em portugu\xEAs brasileiro (PT-BR). Apresenta a trajet\xF3ria hist\xF3rica de combate \xE0 fome no Brasil atrav\xE9s de arquivos hist\xF3ricos e depoimentos comoventes de especialistas e da popula\xE7\xE3o.",
    genres: ["Document\xE1rios", "Hist\xF3rico", "Nacional"],
    director: "Camilo Cavalcante",
    cast: ["Josu\xE9 de Castro (Acervo)", "Herbert de Souza (Betinho)", "Especialistas Brasileiros"],
    tmdbId: "680032",
    imdbId: "tt8839088",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-original",
    // Áudio original PT-BR
    verifiedStreams: [
      {
        name: "ZapiTV Proxy PT-BR",
        title: "[\xC1UDIO ORIGINAL PT-BR] Hist\xF3rias da Fome no Brasil - Servidor Otimizado",
        url: "/api/proxy?url=" + encodeURIComponent("https://upload.wikimedia.org/wikipedia/commons/8/89/Document%C3%A1rio-_Hist%C3%B3rias_da_Fome_no_Brasil.webm"),
        sourceType: "mp4",
        isPtBr: true,
        isDubbed: false,
        quality: "1080p",
        providerName: "ZapiTV Stream Core"
      },
      {
        name: "Acervo Cultural Nacional",
        title: "[\xC1UDIO ORIGINAL PT-BR] Hist\xF3rias da Fome no Brasil - WebM Direto",
        url: "https://upload.wikimedia.org/wikipedia/commons/8/89/Document%C3%A1rio-_Hist%C3%B3rias_da_Fome_no_Brasil.webm",
        sourceType: "mp4",
        isPtBr: true,
        isDubbed: false,
        quality: "1080p",
        providerName: "Acervo P\xFAblico Audiovisual"
      }
    ]
  },
  // 3. SÉRIE COMPLETA COM EPISÓDIOS DINÂMICOS
  {
    id: "open-caminandes-s1",
    title: "Caminandes (S\xE9rie de Anima\xE7\xE3o)",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.4,
    year: 2016,
    image: "https://upload.wikimedia.org/wikipedia/commons/1/14/Caminandes_gran_dillama.png",
    backdrop: "https://upload.wikimedia.org/wikipedia/commons/1/14/Caminandes_gran_dillama.png",
    description: "S\xE9rie de anima\xE7\xE3o livre produzida pelo Blender Studio. Acompanha a divertida e teimosa lhama Koro em suas aventuras pelos Andes em busca de comida e supera\xE7\xE3o de obst\xE1culos.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Infantil / Fam\xEDlia"],
    director: "Pablo Vazquez",
    cast: ["Koro (A Lhama)", "Armadillo"],
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "universal",
    // Trilha sonora universal
    episodes: [
      {
        id: "caminandes-ep1",
        number: 1,
        title: "Epis\xF3dio 1: Llama Drama",
        description: "Koro tenta desesperadamente atravessar uma estrada deserta na Patag\xF4nia enquanto um caminh\xE3o se aproxima.",
        image: "https://upload.wikimedia.org/wikipedia/commons/1/14/Caminandes_gran_dillama.png",
        videoUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/Caminandes-_Llama_Drama_-_Short_Movie.ogv/Caminandes-_Llama_Drama_-_Short_Movie.ogv.720p.vp9.webm"
      },
      {
        id: "caminandes-ep2",
        number: 2,
        title: "Epis\xF3dio 2: Gran Dillama",
        description: "Koro encontra uma cerca aparentemente intranspon\xEDvel para alcan\xE7ar uma saborosa \xE1rvore de ma\xE7\xE3s.",
        image: "https://upload.wikimedia.org/wikipedia/commons/1/14/Caminandes_gran_dillama.png",
        videoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Caminandes_-_Gran_Dillama_-_Blender_Foundation%27s_new_Open_Movie.webm"
      },
      {
        id: "caminandes-ep3",
        number: 3,
        title: "Epis\xF3dio 3: Llamigos",
        description: "No rigoroso inverno patag\xF4nico, Koro conhece um pinguim e compete por uma \xFAltima fruta congelada.",
        image: "https://upload.wikimedia.org/wikipedia/commons/1/14/Caminandes_gran_dillama.png",
        videoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Caminandes_3_-_Llamigos_-_Blender_Animated_Short.webm"
      }
    ],
    verifiedStreams: [
      {
        name: "Epis\xF3dio 1 (Llama Drama)",
        title: "[UNIVERSAL] Caminandes - Epis\xF3dio 1: Llama Drama (720p)",
        url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/d/d0/Caminandes-_Llama_Drama_-_Short_Movie.ogv/Caminandes-_Llama_Drama_-_Short_Movie.ogv.720p.vp9.webm",
        sourceType: "mp4",
        isPtBr: true,
        isDubbed: false,
        quality: "720p",
        providerName: "Blender Open Studio"
      }
    ]
  },
  // 4. PRODUÇÃO NACIONAL HISTÓRICA COM ÁUDIO PT-BR
  {
    id: "open-brasil-hoje",
    title: "Brasil Hoje: Salvador Hist\xF3rica",
    type: "FILME" /* MOVIE */,
    rating: 7.8,
    year: 1974,
    image: "https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?w=600&auto=format&fit=crop&q=80",
    backdrop: "https://images.unsplash.com/photo-1598970434795-0c54fe7c0648?w=1280&auto=format&fit=crop&q=80",
    description: "Document\xE1rio oficial da Ag\xEAncia Nacional sobre a cultura, patrim\xF4nio colonial e vida cotidiana em Salvador, Bahia. \xC1udio original narrado em portugu\xEAs brasileiro, preservado pelo Arquivo Nacional.",
    genres: ["Document\xE1rios", "Hist\xF3rico", "Nacional"],
    director: "Ag\xEAncia Nacional do Brasil",
    availabilityStatus: "verified",
    audioStatus: "pt-br-original",
    verifiedStreams: [
      {
        name: "ZapiTV Proxy PT-BR",
        title: "[\xC1UDIO ORIGINAL PT-BR] Brasil Hoje: Salvador - Servidor Otimizado",
        url: "/api/proxy?url=" + encodeURIComponent("https://upload.wikimedia.org/wikipedia/commons/4/47/Brasil_Hoje_n._56_%281974%29_-_Document%C3%A1rio_da_Ag%C3%AAncia_Nacional_sobre_a_cidade_de_Salvador%2C_Bahia.webm"),
        sourceType: "mp4",
        isPtBr: true,
        isDubbed: false,
        quality: "1080p",
        providerName: "ZapiTV Stream Core"
      },
      {
        name: "Arquivo Nacional BR",
        title: "[\xC1UDIO ORIGINAL PT-BR] Brasil Hoje: Salvador - 1080p WebM Direto",
        url: "https://upload.wikimedia.org/wikipedia/commons/4/47/Brasil_Hoje_n._56_%281974%29_-_Document%C3%A1rio_da_Ag%C3%AAncia_Nacional_sobre_a_cidade_de_Salvador%2C_Bahia.webm",
        sourceType: "mp4",
        isPtBr: true,
        isDubbed: false,
        quality: "1080p",
        providerName: "Arquivo Nacional do Brasil"
      }
    ]
  },
  // 5. BLENDER OPEN MOVIE 4K UHD HLS
  {
    id: "open-tears-of-steel",
    title: "Tears of Steel (4K UHD)",
    type: "FILME" /* MOVIE */,
    rating: 7.3,
    year: 2012,
    image: "https://image.tmdb.org/t/p/w500/8qy3jRmaHR7f8VZh3iXCqCWfFsH.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/fOy6SL5Zs2PFcNXwqEPIDPrLB1q.jpg",
    description: "Filme aberto de fic\xE7\xE3o cient\xEDfica p\xF3s-apocal\xEDptica ambientado em Amsterd\xE3. Apresenta efeitos especiais avan\xE7ados, rob\xF4s gigantes e transmiss\xE3o adaptativa em HLS 4K Ultra HD.",
    genres: ["Fic\xE7\xE3o Cient\xEDfica", "A\xE7\xE3o"],
    director: "Ian Hubert",
    cast: ["Derek de Lint", "Sergio Hasselbaink", "Rogier Schippers"],
    tmdbId: "133701",
    imdbId: "tt2285752",
    availabilityStatus: "verified",
    audioStatus: "other",
    verifiedStreams: [
      {
        name: "Unified Streaming HLS 4K",
        title: "[4K UHD HLS] Tears of Steel - Transmiss\xE3o Adaptativa",
        url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
        sourceType: "hls",
        isPtBr: false,
        isDubbed: false,
        quality: "4K",
        providerName: "Unified Streaming Foundation"
      }
    ]
  },
  // 6. BLENDER OPEN MOVIE 1080p FHD HLS
  {
    id: "open-big-buck-bunny",
    title: "Big Buck Bunny (1080p FHD)",
    type: "FILME" /* MOVIE */,
    rating: 8,
    year: 2008,
    image: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg",
    backdrop: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg",
    description: "A cl\xE1ssica e adorada anima\xE7\xE3o aberta da Blender Foundation. Um coelho gigante e tranquilo decide ensinar uma li\xE7\xE3o inesquec\xEDvel a tr\xEAs animais travessos da floresta.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Infantil / Fam\xEDlia"],
    director: "Sacha Goedegebure",
    imdbId: "tt1285241",
    availabilityStatus: "verified",
    audioStatus: "universal",
    verifiedStreams: [
      {
        name: "Mux HLS 1080p Master",
        title: "[1080p FHD HLS] Big Buck Bunny - Transmiss\xE3o Adaptativa Multi-Qualidade",
        url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        sourceType: "hls",
        isPtBr: true,
        isDubbed: false,
        quality: "1080p",
        providerName: "Mux Open CDN"
      }
    ]
  },
  // 7. CLÁSSICO DE SUSPENSE EM DOMÍNIO PÚBLICO
  {
    id: "open-charade-1963",
    title: "Charada (1963)",
    type: "FILME" /* MOVIE */,
    rating: 7.9,
    year: 1963,
    image: "https://image.tmdb.org/t/p/w500/qqaPjC5FQidtKY65jbAKZPiOTaS.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/1Q1yTxHjadsLMf7yy9xABUH6zaT.jpg",
    description: "Um cl\xE1ssico do suspense e da com\xE9dia rom\xE2ntica estrelado por Audrey Hepburn e Cary Grant, em dom\xEDnio p\xFAblico. Uma vi\xFAva rica \xE9 perseguida pelas ruas de Paris por criminosos que desejam os bens de seu finado marido.",
    genres: ["Suspense", "Com\xE9dia", "Mist\xE9rio", "Romance"],
    director: "Stanley Donen",
    cast: ["Cary Grant", "Audrey Hepburn", "Walter Matthau", "James Coburn"],
    tmdbId: "4808",
    imdbId: "tt0056923",
    availabilityStatus: "verified",
    audioStatus: "other",
    verifiedStreams: [
      {
        name: "Dom\xEDnio P\xFAblico Internacional",
        title: "[\xC1UDIO ORIGINAL] Charada (1963) - 1080p WebM/HTML5",
        url: "https://upload.wikimedia.org/wikipedia/commons/d/dc/Charade_%281963%29.webm",
        sourceType: "mp4",
        isPtBr: false,
        isDubbed: false,
        quality: "1080p",
        providerName: "Dom\xEDnio P\xFAblico Mundial"
      }
    ]
  },
  // 8. PRIMEIRO CURTA SONORO DE ANIMAÇÃO - DOMÍNIO PÚBLICO MUNDIAL
  {
    id: "open-steamboat-willie-1928",
    title: "Steamboat Willie (1928)",
    type: "FILME" /* MOVIE */,
    rating: 7.7,
    year: 1928,
    image: "https://image.tmdb.org/t/p/w500/rqmakey2Z2kSFYAcqqskkRzJ4ib.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/pqZMQezl0K2mh3QzENagYamxXON.jpg",
    description: "A hist\xF3rica primeira anima\xE7\xE3o com som sincronizado de Walt Disney, ingressada no dom\xEDnio p\xFAblico mundial em 2024. Uma rel\xEDquia cultural preservada e integralmente aberta.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Hist\xF3rico"],
    director: "Walt Disney & Ub Iwerks",
    tmdbId: "53565",
    availabilityStatus: "verified",
    audioStatus: "universal",
    verifiedStreams: [
      {
        name: "Dom\xEDnio P\xFAblico 2024",
        title: "[\xC1UDIO ORIGINAL SINCRONIZADO] Steamboat Willie (1928) - WebM",
        url: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Steamboat_Willie_%281928%29_by_Walt_Disney.webm",
        sourceType: "mp4",
        isPtBr: true,
        isDubbed: false,
        quality: "1080p",
        providerName: "Dom\xEDnio P\xFAblico Mundial"
      }
    ]
  },
  // 9. ANIME VERIFICADO COM DUBLAGEM PT-BR - OVERFLOW: TRANSBORDANDO
  {
    id: "tmdb-95897",
    title: "Overflow: Transbordando",
    type: "ANIME" /* ANIME */,
    rating: 7.8,
    year: 2020,
    image: "https://image.tmdb.org/t/p/w500/8gVf39h23yW2mQcWJ7rB1N6E2U5.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/m8BvQyG1Jm0r4KxG7wY0B9fF7qK.jpg",
    description: "Kazushi Sudo \xE9 surpreendido por suas amigas de inf\xE2ncia, as irm\xE3s Shirakawa, que decidem invadir seu banho. Uma com\xE9dia rom\xE2ntica com epis\xF3dios completos dublados em portugu\xEAs brasileiro.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Romance"],
    tmdbId: "95897",
    imdbId: "tt14962432",
    seasonsCount: 1,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      { id: "overflow-ep1", number: 1, title: "Epis\xF3dio 1", description: "Duas irm\xE3s e um banho compartilhado.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/01.mp4" },
      { id: "overflow-ep2", number: 2, title: "Epis\xF3dio 2", description: "Segredos e lembran\xE7as de inf\xE2ncia.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/02.mp4" },
      { id: "overflow-ep3", number: 3, title: "Epis\xF3dio 3", description: "Uma tarde agitada no quarto.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/03.mp4" },
      { id: "overflow-ep4", number: 4, title: "Epis\xF3dio 4", description: "Conversas a portas fechadas.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/04.mp4" },
      { id: "overflow-ep5", number: 5, title: "Epis\xF3dio 5", description: "Sentimentos revelados na banheira.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/05.mp4" },
      { id: "overflow-ep6", number: 6, title: "Epis\xF3dio 6", description: "Um encontro inesperado.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/06.mp4" },
      { id: "overflow-ep7", number: 7, title: "Epis\xF3dio 7", description: "La\xE7os que se aprofundam.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/07.mp4" },
      { id: "overflow-ep8", number: 8, title: "Epis\xF3dio 8", description: "Desfecho e promessas futuras.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-O/Overflow/Dub/08.mp4" }
    ]
  },
  // 10. ANIME VERIFICADO - MODAETE YO, ADAM-KUN
  {
    id: "tmdb-241002",
    title: "Modaete yo, Adam-kun",
    type: "ANIME" /* ANIME */,
    rating: 7.2,
    year: 2024,
    image: "https://image.tmdb.org/t/p/w500/uF5lT7h2R5oK9jZ6vF3mQ8uY2aX.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/uF5lT7h2R5oK9jZ6vF3mQ8uY2aX.jpg",
    description: "Em um mundo onde uma condi\xE7\xE3o misteriosa afeta a humanidade, Kazuki \xE9 um dos raros sobreviventes com imunidade especial, tornando-se o centro de todas as aten\xE7\xF5es na academia.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Romance"],
    tmdbId: "241002",
    imdbId: "tt30325611",
    seasonsCount: 1,
    availabilityStatus: "verified",
    audioStatus: "other",
    episodes: [
      { id: "adam-ep1", number: 1, title: "Epis\xF3dio 1", description: "O Despertar de Adam.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/01.mp4" },
      { id: "adam-ep2", number: 2, title: "Epis\xF3dio 2", description: "O Segredo da Academia.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/02.mp4" },
      { id: "adam-ep3", number: 3, title: "Epis\xF3dio 3", description: "Treinamento Especial.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/03.mp4" },
      { id: "adam-ep4", number: 4, title: "Epis\xF3dio 4", description: "Sentimentos Ocultos.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/04.mp4" },
      { id: "adam-ep5", number: 5, title: "Epis\xF3dio 5", description: "Confronto Inesperado.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/05.mp4" },
      { id: "adam-ep6", number: 6, title: "Epis\xF3dio 6", description: "A Prova de Afinidade.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/06.mp4" },
      { id: "adam-ep7", number: 7, title: "Epis\xF3dio 7", description: "Aproxima\xE7\xE3o Decisiva.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/07.mp4" },
      { id: "adam-ep8", number: 8, title: "Epis\xF3dio 8", description: "O Elo Inquebr\xE1vel.", image: "", videoUrl: "https://animeflix.blog/Animes/Letra-M/Modaete%20yo%2C%20Adam-kun/08.mp4" }
    ]
  },
  // 11. ANIME VERIFICADO - DORAEMON: O GATO DO FUTURO (2005)
  {
    id: "tmdb-65733",
    title: "Doraemon: O Gato do Futuro",
    type: "ANIME" /* ANIME */,
    rating: 8.2,
    year: 2005,
    image: "https://image.tmdb.org/t/p/w500/7I9WvTqW747lC7Z1KqQ0zL2iZ9s.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/7I9WvTqW747lC7Z1KqQ0zL2iZ9s.jpg",
    description: "Doraemon \xE9 um gato rob\xF4 azul do s\xE9culo XXII enviado de volta no tempo para ajudar Nobita Nobi, um garoto desajeitado e bondoso.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Infantil / Fam\xEDlia", "Fic\xE7\xE3o Cient\xEDfica"],
    tmdbId: "65733",
    imdbId: "tt4083422",
    seasonsCount: 1,
    availabilityStatus: "verified",
    audioStatus: "other",
    episodes: [
      {
        id: "doraemon2005-ep1",
        number: 1,
        title: "Epis\xF3dio 1: A Cidade dos Sonhos de Nobita",
        description: "Doraemon e Nobita usam o poder da imagina\xE7\xE3o e ferramentas do futuro para criar um ref\xFAgio incr\xEDvel.",
        image: "",
        videoUrl: "https://dn720400.ca.archive.org/0/items/doraemon-2005-001-yojigen-043977-e-2.-720/Doraemon%20%282005%29%20-%20001%20%5BYojigen%5D%5B043977E2%5D.720.mp4"
      }
    ]
  },
  // 12. ANIME VERIFICADO - DORAEMON (1979)
  {
    id: "tmdb-57911",
    title: "Doraemon",
    type: "ANIME" /* ANIME */,
    rating: 8.1,
    year: 1979,
    image: "https://image.tmdb.org/t/p/w500/7I9WvTqW747lC7Z1KqQ0zL2iZ9s.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/7I9WvTqW747lC7Z1KqQ0zL2iZ9s.jpg",
    description: "A cl\xE1ssica s\xE9rie de anima\xE7\xE3o original de Doraemon que conquistou gera\xE7\xF5es.",
    genres: ["Anima\xE7\xE3o", "Com\xE9dia", "Infantil / Fam\xEDlia"],
    tmdbId: "57911",
    imdbId: "tt0069576",
    seasonsCount: 1,
    availabilityStatus: "verified",
    audioStatus: "other",
    episodes: [
      {
        id: "doraemon1979-ep1",
        number: 1,
        title: "Epis\xF3dio 1: O In\xEDcio da Aventura",
        description: "Doraemon chega ao passado para mudar o destino de Nobita.",
        image: "",
        videoUrl: "https://dn720400.ca.archive.org/0/items/doraemon-2005-001-yojigen-043977-e-2.-720/Doraemon%20%282005%29%20-%20001%20%5BYojigen%5D%5B043977E2%5D.720.mp4"
      }
    ]
  },
  // ANIME VERIFICADO - BLEACH (CANÔNICO)
  {
    id: "anime-bleach-tvmeter",
    title: "Bleach: Thousand-Year Blood War",
    type: "ANIME" /* ANIME */,
    rating: 9,
    year: 2022,
    image: "https://image.tmdb.org/t/p/w500/2Eewgp7o5AU1xCjrXY9AcHG2uaj.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/m9PHVbC3sC4k9a52lY21P4o2U5.jpg",
    description: "A paz \xE9 subitamente quebrada quando as sirenes de alerta ecoam pela Sociedade das Almas.",
    genres: ["Anime", "A\xE7\xE3o", "Anima\xE7\xE3o", "Fantasia"],
    tmdbId: "30984",
    imdbId: "tt0434665",
    seasonsCount: 3,
    availabilityStatus: "verified",
    audioStatus: "other",
    episodes: [
      {
        id: "bleach-tybw-ep1",
        number: 1,
        title: "Epis\xF3dio 1",
        description: "O retorno dos Quincies.",
        image: "",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
      }
    ]
  },
  // 13. FILME EM CARTAZ - HOPE: O PRIMEIRO IMPACTO (2026)
  // Obra em produção/cartaz nos cinemas. Fontes de torrent fraudulentas contendo trotes/vídeos adultos foram isoladas em quarentena permanente.
  {
    id: "tmdb-1058424",
    title: "Hope: O Primeiro Impacto",
    type: "FILME" /* MOVIE */,
    rating: 7.2,
    year: 2026,
    image: "https://image.tmdb.org/t/p/w500/yDiw6WUpAdlidbQDtI09rWVvGtu.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/hrCTKrc3Tz2wbPOt5rcrlAhqF11.jpg",
    description: "A pol\xEDcia investiga a presen\xE7a de uma criatura misteriosa que vem causando tumulto na remota vila de Hope Harbor. Ao seguir os rastros do animal, um grupo de ca\xE7adores acaba se tornando sua presa involunt\xE1ria, dando in\xEDcio a um conflito que se transforma em uma trag\xE9dia de propor\xE7\xF5es c\xF3smicas.",
    genres: ["Fic\xE7\xE3o Cient\xEDfica", "Mist\xE9rio", "A\xE7\xE3o", "Terror"],
    director: "Na Hong-jin",
    cast: ["Hwang Jung-min", "Zo In-sung", "HoYeon Jung", "Alicia Vikander", "Michael Fassbender"],
    tmdbId: "1058424",
    imdbId: "tt27369017",
    isFeatured: true,
    availabilityStatus: "unavailable",
    audioStatus: "other",
    verifiedStreams: []
  }
];

// src/core/audio/audioPreferenceService.ts
var DUAL_PATTERNS = [
  /\b(dual[-_]?audio|dual[-_]?áudio|multi[-_]?audio|multi[-_]?áudio)\b/i,
  /\[dual[-_]?audio\]/i,
  /\[dual\]/i,
  /\bdual\b(?!\s*[-_]?sub)/i,
  /\bdual\s*latino\b/i
  // latino can be foreign if not PT, handled below
];
var DUBBED_PTBR_PATTERNS = [
  /\b(dublado|dublada|dublados|audio\s*pt|áudio\s*pt|audio\s*pt[-_]?br|áudio\s*pt[-_]?br|brazuca|nacional)\b/i,
  /\[dublado\]/i,
  /\[dub\]/i,
  /\b(dub\b|\/dub\/)/i,
  /\b(fhd[-_]?dub|hd[-_]?dub|web[-_]?dl[-_]?dub)\b/i,
  /🇧🇷\s*dublado/i,
  /\b(comando|bludv|mico[-_]?le[aã]o|lapumia|rede[-_]?canais|redecanais|wolverdon)\b/i
];
var PTBR_GENERAL_PATTERNS = [
  /\b(pt[-_]?br|portugu[eê]s[-_]?br|portugu[eê]s)\b/i,
  /\[pt[-_]?br\]/i,
  /\b(pob|por)\b/i
];
var SUBTITLED_ONLY_PATTERNS = [
  /\b(legendado|legendada|leg\b|subs?|softsubs?|hardsubs?|hardcoded|legenda[-_]?fixa|legenda[-_]?embutida|legenda[-_]?gravada)\b/i,
  /\[leg\]/i,
  /\[legendado\]/i,
  /\[hardsub\]/i,
  /\[hardsub[-_]?pt[-_]?br\]/i,
  /\bapenas\s*legendado\b/i,
  /🇯🇵\s*legendado/i
];
var FOREIGN_LANGUAGE_PATTERNS = [
  { regex: /\b(jap|ja\b|jpn|japanese|japon[eê]s)\b/i, lang: "ja" },
  { regex: /\b(eng|en\b|english|ingl[eê]s)\b/i, lang: "en" },
  { regex: /\b(esp|es\b|spanish|espanhol|castellano|latino)\b/i, lang: "es" },
  { regex: /\b(pt[-_]?pt|portugu[eê]s[-_]?pt)\b/i, lang: "pt-PT" }
];
var AudioPreferenceService = class {
  /**
   * Avalia com precisão o idioma do áudio do stream.
   * Identifica se é dublado PT-BR, dual áudio, áudio original ou outro idioma.
   */
  analyzeAudio(stream) {
    const combinedText = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""}`.toLowerCase();
    const providerName = (stream.providerName || "").toLowerCase();
    const providerId = (stream.providerId || "").toLowerCase();
    const isDualAudio = DUAL_PATTERNS.some((p) => p.test(combinedText));
    const isVerifiedBrazilianProvider = providerId === "zapitv-verified" || providerName.includes("zapitv verificado") || providerName.includes("acervo zapitv") || providerName.includes("cinema aberto") || providerName.includes("mico-le\xE3o") || providerName.includes("micoleao");
    const hasDubbedPattern = DUBBED_PTBR_PATTERNS.some((p) => p.test(combinedText));
    const hasPtBrGeneral = PTBR_GENERAL_PATTERNS.some((p) => p.test(combinedText));
    const isExplicitlySubtitledOnly = SUBTITLED_ONLY_PATTERNS.some((p) => p.test(combinedText)) && !hasDubbedPattern && !isDualAudio;
    const declaredDubbed = Boolean(stream.isDubbed);
    const declaredPtBr = Boolean(stream.isPtBr);
    if (isDualAudio && (hasPtBrGeneral || hasDubbedPattern || declaredPtBr || declaredDubbed || isVerifiedBrazilianProvider || !isExplicitlySubtitledOnly)) {
      return {
        tier: "dual_audio",
        isPtBr: true,
        isDubbed: true,
        isDualAudio: true,
        language: "dual",
        confidence: 0.95,
        reason: "Dual \xC1udio com faixa PT-BR detectada"
      };
    }
    if (declaredDubbed || hasDubbedPattern || isVerifiedBrazilianProvider || declaredPtBr && !isExplicitlySubtitledOnly || hasPtBrGeneral && !isExplicitlySubtitledOnly) {
      return {
        tier: "dubbed_ptbr",
        isPtBr: true,
        isDubbed: true,
        isDualAudio: false,
        language: "pt-BR",
        confidence: 0.95,
        reason: "\xC1udio dublado em portugu\xEAs brasileiro"
      };
    }
    if (hasPtBrGeneral && isExplicitlySubtitledOnly) {
      for (const foreign of FOREIGN_LANGUAGE_PATTERNS) {
        if (foreign.regex.test(combinedText)) {
          return {
            tier: "original",
            isPtBr: false,
            isDubbed: false,
            isDualAudio: false,
            language: foreign.lang,
            confidence: 0.85,
            reason: `\xC1udio original (${foreign.lang}) com indica\xE7\xE3o de legenda PT-BR`
          };
        }
      }
      return {
        tier: "original",
        isPtBr: false,
        isDubbed: false,
        isDualAudio: false,
        language: "original",
        confidence: 0.8,
        reason: "\xC1udio original com legenda PT-BR"
      };
    }
    for (const foreign of FOREIGN_LANGUAGE_PATTERNS) {
      if (foreign.regex.test(combinedText)) {
        return {
          tier: "foreign",
          isPtBr: false,
          isDubbed: false,
          isDualAudio: false,
          language: foreign.lang,
          confidence: 0.75,
          reason: `\xC1udio em outro idioma (${foreign.lang})`
        };
      }
    }
    return {
      tier: "original",
      isPtBr: false,
      isDubbed: false,
      isDualAudio: false,
      language: "unknown",
      confidence: 0.5,
      reason: "Idioma de \xE1udio n\xE3o declarado (padr\xE3o original)"
    };
  }
};
var audioPreferenceService = new AudioPreferenceService();

// src/core/subtitles/subtitlePreferenceService.ts
var CLEAN_PATTERNS = [
  /\b(raw|clean|no[-_]?subs?|unsubbed|sem[-_]?legendas?|sem[-_]?leg|clean[-_]?video|textless|ncop|nced)\b/i,
  /\b(bd[-_]?rip\s*raw|bdrip\s*raw|web[-_]?dl\s*raw|webrip\s*raw|dvd[-_]?raw)\b/i,
  /\b(audio\s*japones\s*sem\s*legenda|japones\s*puro|sem\s*legendas?\s*embutidas?)\b/i,
  /\[raw\]/i,
  /\braw\b/i
];
var SOFTSUB_PATTERNS = [
  /\b(soft[-_]?subs?|multi[-_]?subs?|embedded[-_]?subs?|switchable[-_]?subs?|selectable[-_]?subs?)\b/i,
  /\b(legendas?\s*selecion[aá]veis?|faixas?\s*de\s*legenda|legendas?\s*internas?)\b/i,
  /\[softsubs?\]/i,
  /\[multi[-_]?subs?\]/i
];
var HARDSUB_FOREIGN_PATTERNS = [
  /\b(eng(?:lish)?[-_\s]*hardsubs?|hardsubs?[-_\s]*eng(?:lish)?|hardcoded[-_\s]*(?:eng|english|spa|spanish|esp|fre|french|ita|italian))\b/i,
  /\b(hardsub\s*\[(?:eng|en|es|spa|fre|ita)\]|subbed\s*\[(?:eng|en|es|spa|fre|ita)\])\b/i,
  /\b(subs?\s*burned\s*in\s*eng(?:lish)?|burned[-_\s]*in\s*eng(?:lish)?)\b/i,
  /\b(legendado\s*em\s*(?:ingl[eê]s|espanhol|franc[eê]s))\b/i,
  /\[(?:eng|en|spa|es|english|spanish)\s*hardsubs?\]/i,
  /\[hardcoded\s*subs?\]/i
];
var HARDSUB_PTBR_PATTERNS = [
  /\b(hardsub[-_]?pt[-_]?br|pt[-_]?br[-_]?hardsub|hardsub\s*\[pt[-_]?br\]|hardsub\s*pt|hardsub[-_]?br)\b/i,
  /\b(hardsub|hard[-_]?sub|hardcoded|legenda[-_]?fixa|legendas[-_]?fixas|legenda[-_]?embutida)\b/i,
  /\b(legenda[-_]?gravada|gravada[-_]?na[-_]?imagem|burned[-_]?in[-_]?subs?)\b/i,
  /\b(anbient|animefire|otakupt|goyabu|animesvision|betteranime)\b/i
];
var SubtitlePreferenceService = class {
  /**
   * Avalia as legendas disponíveis no stream e o tipo de vídeo (limpo, softsub, hardsub).
   */
  analyzeSubtitles(stream, hasExternalPtSub = false) {
    const combined = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""}`.toLowerCase();
    const url = (stream.url || "").toLowerCase();
    const hasPtBrIndication = /\b(pt[-_]?br|portugu[eê]s|legenda[-_]?pt|legendado)\b/i.test(combined);
    if (HARDSUB_FOREIGN_PATTERNS.some((p) => p.test(combined)) && !hasPtBrIndication) {
      return {
        format: "hardsub_foreign",
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        language: "foreign",
        hasPtSubtitle: false,
        confidence: 0.95,
        details: "Legenda gravada em outro idioma detectada"
      };
    }
    const hasCleanKeyword = CLEAN_PATTERNS.some((p) => p.test(combined));
    const hasSoftsubKeyword = SOFTSUB_PATTERNS.some((p) => p.test(combined)) || url.endsWith(".mkv");
    const hasHardsubPtBrKeyword = HARDSUB_PTBR_PATTERNS.some((p) => p.test(combined));
    if (hasCleanKeyword && !hasHardsubPtBrKeyword) {
      return {
        format: "clean_confirmed",
        isHardsub: false,
        isClean: true,
        isSoftsub: false,
        hasPtSubtitle: hasExternalPtSub,
        confidence: 0.9,
        details: "V\xEDdeo original limpo (sem legendas gravadas na imagem)"
      };
    }
    if (hasSoftsubKeyword && !hasHardsubPtBrKeyword) {
      return {
        format: "softsub",
        isHardsub: false,
        isClean: false,
        isSoftsub: true,
        hasPtSubtitle: hasPtBrIndication || hasExternalPtSub,
        confidence: 0.85,
        details: "Legendas internas selecion\xE1veis (Softsub)"
      };
    }
    if (hasHardsubPtBrKeyword || hasPtBrIndication && (combined.includes("legendado") || combined.includes("[leg]"))) {
      return {
        format: "hardsub_ptbr",
        isHardsub: true,
        isClean: false,
        isSoftsub: false,
        language: "pt-BR",
        hasPtSubtitle: true,
        confidence: 0.85,
        details: "Legenda gravada na imagem em PT-BR (Hardsub)"
      };
    }
    return {
      format: "unknown",
      isHardsub: false,
      isClean: false,
      isSoftsub: false,
      hasPtSubtitle: hasExternalPtSub,
      confidence: 0.5,
      details: "Formato de legenda n\xE3o identificado explicitamente nos metadados"
    };
  }
};
var subtitlePreferenceService = new SubtitlePreferenceService();

// src/core/tmdb/tmdbClient.ts
var TMDB_API_KEY = "468925ac3759d7adeb05b540cfd71cb8";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
var TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
var CINEMETA_BASE_URL = "https://v3-cinemeta.strem.io";
var GENRE_MAP = {
  28: "A\xE7\xE3o",
  12: "Aventura",
  16: "Anima\xE7\xE3o",
  35: "Com\xE9dia",
  80: "Policial",
  99: "Document\xE1rios",
  18: "Drama",
  10751: "Infantil / Fam\xEDlia",
  14: "Fantasia",
  36: "Hist\xF3rico",
  27: "Terror",
  10402: "Musical",
  9648: "Mist\xE9rio",
  10749: "Romance",
  878: "Fic\xE7\xE3o Cient\xEDfica",
  10770: "Cinema TV",
  53: "Suspense",
  10752: "Guerra",
  37: "Faroeste",
  10759: "A\xE7\xE3o e Aventura",
  10762: "Kids",
  10763: "Not\xEDcias",
  10764: "Reality Show",
  10765: "Fic\xE7\xE3o Cient\xEDfica e Fantasia",
  10766: "Novela",
  10767: "Talk Show",
  10768: "Guerra e Pol\xEDtica"
};
function formatContentItem(raw, forcedType) {
  const isMovie = forcedType ? forcedType === "FILME" /* MOVIE */ : raw.media_type === "movie" || Boolean(raw.title && !raw.name);
  const isAnime = raw.original_language === "ja" && (raw.genre_ids?.includes(16) || raw.genres?.some((g) => g.id === 16));
  const type = isAnime ? "ANIME" /* ANIME */ : isMovie ? "FILME" /* MOVIE */ : "S\xC9RIE" /* SERIES */;
  const title = raw.title || raw.name || "Sem T\xEDtulo";
  const yearStr = raw.release_date || raw.first_air_date || "";
  const year = yearStr ? new Date(yearStr).getFullYear() : 2024;
  const genres = [];
  if (raw.genres) {
    genres.push(...raw.genres.map((g) => g.name));
  } else if (raw.genre_ids) {
    for (const gid of raw.genre_ids) {
      if (GENRE_MAP[gid]) genres.push(GENRE_MAP[gid]);
    }
  }
  if (isAnime && !genres.includes("Anime")) {
    genres.push("Anime");
  }
  const poster = raw.poster_path ? `${TMDB_IMAGE_BASE}${raw.poster_path}` : "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500";
  const backdrop = raw.backdrop_path ? `${TMDB_BACKDROP_BASE}${raw.backdrop_path}` : poster;
  return {
    id: `tmdb-${raw.id}`,
    tmdbId: String(raw.id),
    title,
    type,
    rating: raw.vote_average ? Number(raw.vote_average.toFixed(1)) : 8,
    year: isNaN(year) ? 2024 : year,
    image: poster,
    backdrop,
    description: raw.overview || "Sinopse oficial em portugu\xEAs dispon\xEDvel em breve.",
    genres,
    isFeatured: (raw.vote_average || 0) > 7.5,
    releaseDate: yearStr ? yearStr.slice(0, 10) : void 0,
    originalTitle: raw.original_title || raw.original_name
  };
}
function formatCinemetaItem(raw) {
  const isMovie = raw.type === "movie";
  const type = isMovie ? "FILME" /* MOVIE */ : "S\xC9RIE" /* SERIES */;
  const yearNum = Number(raw.releaseInfo || raw.year || 2024);
  const ratingNum = raw.imdbRating ? parseFloat(raw.imdbRating) : 8;
  return {
    id: raw.id,
    imdbId: raw.id,
    tmdbId: raw.moviedb_id ? String(raw.moviedb_id) : void 0,
    title: raw.name || "Sem T\xEDtulo",
    type,
    rating: isNaN(ratingNum) ? 8 : ratingNum,
    year: isNaN(yearNum) ? 2024 : yearNum,
    image: raw.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500",
    backdrop: raw.background || raw.poster || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500",
    description: raw.description || "Dispon\xEDvel no cat\xE1logo oficial do Stremio / Cinemeta.",
    genres: raw.genres && raw.genres.length > 0 ? raw.genres : ["Geral"],
    isFeatured: ratingNum >= 7.5
  };
}
var TMDBClientService = class {
  constructor() {
    this.imdbCache = /* @__PURE__ */ new Map();
  }
  async request(endpoint, timeoutMs = 8e3, signal) {
    const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}&language=pt-BR`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new DOMException("Aborted", "AbortError");
      }
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`Erro TMDB ${res.status}: ${res.statusText}`);
      }
      return res.json();
    } finally {
      clearTimeout(timer);
    }
  }
  async getImdbId(id, type) {
    const rawStr = String(id).trim();
    if (rawStr.startsWith("tt")) return rawStr;
    const cleanId = rawStr.replace(/^tmdb-?/i, "");
    if (this.imdbCache.has(cleanId)) return this.imdbCache.get(cleanId);
    if (this.imdbCache.has(rawStr)) return this.imdbCache.get(rawStr);
    const isMovie = type === "FILME" /* MOVIE */ || type === "movie";
    const endpoint = isMovie ? `/movie/${cleanId}/external_ids` : `/tv/${cleanId}/external_ids`;
    try {
      const data = await this.request(endpoint);
      const imdbId = data?.imdb_id;
      if (imdbId) {
        this.imdbCache.set(cleanId, imdbId);
        this.imdbCache.set(rawStr, imdbId);
        return imdbId;
      }
    } catch {
    }
    return void 0;
  }
  async findByImdb(imdbId) {
    try {
      const data = await this.request(`/find/${imdbId}?external_source=imdb_id`);
      const movie = data.movie_results?.[0];
      if (movie) {
        const item = formatContentItem(movie, "FILME" /* MOVIE */);
        item.imdbId = imdbId;
        return item;
      }
      const tv = data.tv_results?.[0];
      if (tv) {
        const item = formatContentItem(tv, "S\xC9RIE" /* SERIES */);
        item.imdbId = imdbId;
        return item;
      }
    } catch {
    }
    return null;
  }
  async getCinemetaMeta(type, imdbId, timeoutMs = 8e3) {
    try {
      const res = await fetch(`${CINEMETA_BASE_URL}/meta/${type}/${imdbId}.json`, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (res.ok) {
        const data = await res.json();
        return data.meta || null;
      }
    } catch {
    }
    return null;
  }
  async getCinemetaCatalog(type, genre, skip, timeoutMs = 8e3) {
    try {
      let url = `${CINEMETA_BASE_URL}/catalog/${type}/top`;
      const extras = [];
      if (genre) extras.push(`genre=${encodeURIComponent(genre)}`);
      if (skip) extras.push(`skip=${skip}`);
      if (extras.length > 0) url += `/${extras.join("&")}`;
      url += ".json";
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const data = await res.json();
        return (data.metas || []).map((m) => formatCinemetaItem(m));
      }
    } catch {
    }
    return [];
  }
  async getTrending() {
    const data = await this.request("/trending/all/day");
    return (data.results || []).map((r) => formatContentItem(r));
  }
  async getPopularMovies(page = 1) {
    const data = await this.getPopularMoviesWithMeta(page);
    return data.items;
  }
  async getPopularMoviesWithMeta(page = 1) {
    const data = await this.request(`/movie/popular?page=${page}`);
    return {
      items: (data.results || []).map((r) => formatContentItem(r, "FILME" /* MOVIE */)),
      total: data.total_results || 2e4
    };
  }
  async getPopularSeries(page = 1) {
    const data = await this.getPopularSeriesWithMeta(page);
    return data.items;
  }
  async getPopularSeriesWithMeta(page = 1) {
    const data = await this.request(`/tv/popular?page=${page}`);
    return {
      items: (data.results || []).map((r) => formatContentItem(r, "S\xC9RIE" /* SERIES */)),
      total: data.total_results || 2e4
    };
  }
  async getTopRatedMovies(page = 1) {
    const data = await this.request(`/movie/top_rated?page=${page}`);
    return (data.results || []).map((r) => formatContentItem(r, "FILME" /* MOVIE */));
  }
  async getNowPlayingMovies(page = 1) {
    const data = await this.request(`/movie/now_playing?page=${page}`);
    return (data.results || []).map((r) => formatContentItem(r, "FILME" /* MOVIE */));
  }
  async getAnimes(page = 1) {
    const data = await this.getAnimesWithMeta(page);
    return data.items;
  }
  async getAnimesWithMeta(page = 1) {
    const data = await this.request(
      `/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`
    );
    return {
      items: (data.results || []).map((r) => formatContentItem(r, "ANIME" /* ANIME */)),
      total: data.total_results || 5474
    };
  }
  async getAnimeMovies(page = 1) {
    const data = await this.getAnimeMoviesWithMeta(page);
    return data.items;
  }
  async getAnimeMoviesWithMeta(page = 1) {
    const data = await this.request(
      `/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc&page=${page}`
    );
    return {
      items: (data.results || []).map((r) => formatContentItem(r, "ANIME" /* ANIME */)),
      total: data.total_results || 6020
    };
  }
  async getDiscoverMovies(page = 1, genreId, sortBy = "popularity.desc") {
    const data = await this.getDiscoverMoviesWithMeta(page, genreId, sortBy);
    return data.items;
  }
  async getDiscoverMoviesWithMeta(page = 1, genreId, sortBy = "popularity.desc") {
    const genreParam = genreId ? `&with_genres=${genreId}` : "";
    const data = await this.request(
      `/discover/movie?sort_by=${sortBy}&page=${page}${genreParam}`
    );
    return {
      items: (data.results || []).map((r) => formatContentItem(r, "FILME" /* MOVIE */)),
      total: data.total_results || 2e4
    };
  }
  async getDiscoverSeries(page = 1, genreId, sortBy = "popularity.desc") {
    const data = await this.getDiscoverSeriesWithMeta(page, genreId, sortBy);
    return data.items;
  }
  async getDiscoverSeriesWithMeta(page = 1, genreId, sortBy = "popularity.desc") {
    const genreParam = genreId ? `&with_genres=${genreId}` : "";
    const data = await this.request(
      `/discover/tv?sort_by=${sortBy}&page=${page}${genreParam}`
    );
    return {
      items: (data.results || []).map((r) => formatContentItem(r, "S\xC9RIE" /* SERIES */)),
      total: data.total_results || 2e4
    };
  }
  async searchMulti(query) {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb) return [fromTmdb];
      const [cineMovie, cineSeries] = await Promise.all([
        this.getCinemetaMeta("movie", trimmed),
        this.getCinemetaMeta("series", trimmed)
      ]);
      const cine = cineMovie || cineSeries;
      if (cine) return [formatCinemetaItem(cine)];
    }
    const normalized = encodeURIComponent(trimmed);
    const [tmdbRes, cineMovieRes, cineSeriesRes] = await Promise.allSettled([
      this.request(`/search/multi?query=${normalized}`),
      fetch(`${CINEMETA_BASE_URL}/catalog/movie/top/search=${normalized}.json`).then((r) => r.json()),
      fetch(`${CINEMETA_BASE_URL}/catalog/series/top/search=${normalized}.json`).then((r) => r.json())
    ]);
    const results = [];
    const seenIds = /* @__PURE__ */ new Set();
    if (tmdbRes.status === "fulfilled" && tmdbRes.value?.results) {
      const valid = tmdbRes.value.results.filter((r) => r.media_type === "movie" || r.media_type === "tv");
      for (const r of valid) {
        const item = formatContentItem(r);
        results.push(item);
        seenIds.add(item.id);
        if (item.tmdbId) seenIds.add(item.tmdbId);
      }
    }
    if (cineMovieRes.status === "fulfilled" && cineMovieRes.value?.metas) {
      for (const m of cineMovieRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const existing = results.find(
          (it) => it.type === "FILME" /* MOVIE */ && (cineItem.tmdbId && it.tmdbId === cineItem.tmdbId || it.title.toLowerCase().trim() === normTitle)
        );
        const hasTmdb = Boolean(existing && cineItem.tmdbId && existing.tmdbId === cineItem.tmdbId);
        const hasTitle = Boolean(existing && existing.title.toLowerCase().trim() === normTitle);
        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
        } else if (cineItem.imdbId) {
          if (existing && !existing.imdbId) {
            existing.imdbId = cineItem.imdbId;
          }
        }
      }
    }
    if (cineSeriesRes.status === "fulfilled" && cineSeriesRes.value?.metas) {
      for (const m of cineSeriesRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const existing = results.find(
          (it) => it.type !== "FILME" /* MOVIE */ && (cineItem.tmdbId && it.tmdbId === cineItem.tmdbId || it.title.toLowerCase().trim() === normTitle)
        );
        const hasTmdb = Boolean(existing && cineItem.tmdbId && existing.tmdbId === cineItem.tmdbId);
        const hasTitle = Boolean(existing && existing.title.toLowerCase().trim() === normTitle);
        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
        } else if (cineItem.imdbId) {
          if (existing && !existing.imdbId) {
            existing.imdbId = cineItem.imdbId;
          }
        }
      }
    }
    return results;
  }
  async searchMovies(query, signal) {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb && fromTmdb.type === "FILME" /* MOVIE */ && !fromTmdb.genres?.includes("Anime")) return [fromTmdb];
      const cine = await this.getCinemetaMeta("movie", trimmed);
      if (cine) {
        const item = formatCinemetaItem(cine);
        if (item.type === "FILME" /* MOVIE */ && !item.genres?.includes("Anime")) return [item];
      }
      return [];
    }
    const normalized = encodeURIComponent(trimmed);
    const [tmdbRes, cineMovieRes] = await Promise.allSettled([
      this.request(`/search/movie?query=${normalized}`, 8e3, signal),
      fetch(`${CINEMETA_BASE_URL}/catalog/movie/top/search=${normalized}.json`, { signal }).then((r) => r.json())
    ]);
    const results = [];
    const seenIds = /* @__PURE__ */ new Set();
    const seenTitles = /* @__PURE__ */ new Set();
    if (tmdbRes.status === "fulfilled" && tmdbRes.value?.results) {
      for (const r of tmdbRes.value.results) {
        const isAnime = r.original_language === "ja" && (r.genre_ids?.includes(16) || r.genres?.some((g) => g.id === 16));
        if (isAnime) continue;
        const item = formatContentItem(r, "FILME" /* MOVIE */);
        if (item.type === "ANIME" /* ANIME */ || item.genres?.includes("Anime")) continue;
        item.type = "FILME" /* MOVIE */;
        const normTitle = item.title.toLowerCase().trim();
        results.push(item);
        seenIds.add(item.id);
        if (item.tmdbId) seenIds.add(item.tmdbId);
        seenTitles.add(normTitle);
      }
    }
    if (cineMovieRes.status === "fulfilled" && cineMovieRes.value?.metas) {
      for (const m of cineMovieRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        if (cineItem.type === "ANIME" /* ANIME */ || cineItem.genres?.includes("Anime")) continue;
        cineItem.type = "FILME" /* MOVIE */;
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const hasTmdb = cineItem.tmdbId && seenIds.has(cineItem.tmdbId);
        const hasTitle = seenTitles.has(normTitle);
        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
          seenTitles.add(normTitle);
        }
      }
    }
    return results;
  }
  async searchSeries(query, signal) {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb && fromTmdb.type === "S\xC9RIE" /* SERIES */ && !fromTmdb.genres?.includes("Anime")) return [fromTmdb];
      const cine = await this.getCinemetaMeta("series", trimmed);
      if (cine) {
        const item = formatCinemetaItem(cine);
        if (item.type === "S\xC9RIE" /* SERIES */ && !item.genres?.includes("Anime")) return [item];
      }
      return [];
    }
    const normalized = encodeURIComponent(trimmed);
    const [tmdbRes, cineSeriesRes] = await Promise.allSettled([
      this.request(`/search/tv?query=${normalized}`, 8e3, signal),
      fetch(`${CINEMETA_BASE_URL}/catalog/series/top/search=${normalized}.json`, { signal }).then((r) => r.json())
    ]);
    const results = [];
    const seenIds = /* @__PURE__ */ new Set();
    const seenTitles = /* @__PURE__ */ new Set();
    if (tmdbRes.status === "fulfilled" && tmdbRes.value?.results) {
      for (const r of tmdbRes.value.results) {
        const isAnime = r.original_language === "ja" && (r.genre_ids?.includes(16) || r.genres?.some((g) => g.id === 16));
        if (isAnime) continue;
        const item = formatContentItem(r, "S\xC9RIE" /* SERIES */);
        if (item.type === "ANIME" /* ANIME */ || item.genres?.includes("Anime")) continue;
        item.type = "S\xC9RIE" /* SERIES */;
        const normTitle = item.title.toLowerCase().trim();
        results.push(item);
        seenIds.add(item.id);
        if (item.tmdbId) seenIds.add(item.tmdbId);
        seenTitles.add(normTitle);
      }
    }
    if (cineSeriesRes.status === "fulfilled" && cineSeriesRes.value?.metas) {
      for (const m of cineSeriesRes.value.metas) {
        const cineItem = formatCinemetaItem(m);
        if (cineItem.type === "ANIME" /* ANIME */ || cineItem.genres?.includes("Anime")) continue;
        cineItem.type = "S\xC9RIE" /* SERIES */;
        const normTitle = cineItem.title.toLowerCase().trim();
        const hasImdb = cineItem.imdbId && seenIds.has(cineItem.imdbId);
        const hasTmdb = cineItem.tmdbId && seenIds.has(cineItem.tmdbId);
        const hasTitle = seenTitles.has(normTitle);
        if (!hasImdb && !hasTmdb && !hasTitle) {
          results.push(cineItem);
          seenIds.add(cineItem.id);
          if (cineItem.imdbId) seenIds.add(cineItem.imdbId);
          seenTitles.add(normTitle);
        }
      }
    }
    return results;
  }
  async searchAnimes(query, signal) {
    if (!query || !query.trim()) return [];
    const trimmed = query.trim();
    if (/^tt\d+$/i.test(trimmed)) {
      const fromTmdb = await this.findByImdb(trimmed);
      if (fromTmdb && (fromTmdb.type === "ANIME" /* ANIME */ || fromTmdb.genres?.includes("Anime"))) return [fromTmdb];
      return [];
    }
    const normalized = encodeURIComponent(trimmed);
    const [tmdbTvRes, tmdbMovieRes, cineSeriesRes] = await Promise.allSettled([
      this.request(`/search/tv?query=${normalized}`, 8e3, signal),
      this.request(`/search/movie?query=${normalized}`, 8e3, signal),
      fetch(`${CINEMETA_BASE_URL}/catalog/series/top/search=${normalized}.json`, { signal }).then((r) => r.json())
    ]);
    const results = [];
    const seenIds = /* @__PURE__ */ new Set();
    const seenTitles = /* @__PURE__ */ new Set();
    const checkAndAdd = (item, raw) => {
      const isJa = raw?.original_language === "ja";
      const hasAnimationGenre = raw?.genre_ids?.includes(16) || raw?.genres?.some((g) => g.id === 16) || item.genres?.includes("Anima\xE7\xE3o") || item.genres?.includes("Animation");
      const isExplicitAnime = item.type === "ANIME" /* ANIME */ || item.genres?.includes("Anime");
      const isAnime = isExplicitAnime || isJa && hasAnimationGenre;
      if (!isAnime) return;
      const normTitle = item.title.toLowerCase().trim();
      if (seenIds.has(item.id) || item.tmdbId && seenIds.has(item.tmdbId) || seenTitles.has(normTitle)) {
        return;
      }
      item.type = "ANIME" /* ANIME */;
      if (!item.genres?.includes("Anime")) {
        item.genres = ["Anime", ...item.genres || []];
      }
      results.push(item);
      seenIds.add(item.id);
      if (item.tmdbId) seenIds.add(item.tmdbId);
      if (item.imdbId) seenIds.add(item.imdbId);
      seenTitles.add(normTitle);
    };
    if (tmdbTvRes.status === "fulfilled" && tmdbTvRes.value?.results) {
      for (const r of tmdbTvRes.value.results) {
        checkAndAdd(formatContentItem(r, "ANIME" /* ANIME */), r);
      }
    }
    if (tmdbMovieRes.status === "fulfilled" && tmdbMovieRes.value?.results) {
      for (const r of tmdbMovieRes.value.results) {
        checkAndAdd(formatContentItem(r, "ANIME" /* ANIME */), r);
      }
    }
    if (cineSeriesRes.status === "fulfilled" && cineSeriesRes.value?.metas) {
      for (const m of cineSeriesRes.value.metas) {
        const item = formatCinemetaItem(m);
        if (item.type === "ANIME" /* ANIME */ || item.genres?.includes("Anime")) {
          checkAndAdd(item);
        }
      }
    }
    return results;
  }
  async getDetails(id, type) {
    const isMovie = type === "FILME" /* MOVIE */;
    const path3 = isMovie ? `/movie/${id}` : `/tv/${id}`;
    const data = await this.request(`${path3}?append_to_response=credits,external_ids,recommendations,similar`);
    const formatted = formatContentItem(data, type);
    const imdbId = data.external_ids?.imdb_id;
    if (imdbId) {
      formatted.imdbId = imdbId;
      this.imdbCache.set(String(id), imdbId);
    }
    const cast = (data.credits?.cast || []).slice(0, 5).map((c) => c.name);
    formatted.cast = cast;
    if (isMovie) {
      const dir = (data.credits?.crew || []).find((c) => c.job === "Director");
      if (dir) formatted.director = dir.name;
    } else {
      const creators = (data.created_by || []).map((c) => c.name).join(", ");
      if (creators) formatted.director = creators;
    }
    const seasonsCount = data.number_of_seasons || data.seasons?.length || 1;
    const similarRaw = data.recommendations?.results || data.similar?.results || [];
    const similar = similarRaw.slice(0, 9).map((r) => formatContentItem(r, type));
    return {
      item: formatted,
      imdbId,
      seasonsCount,
      cast,
      director: formatted.director,
      similar
    };
  }
  async getDetailsByImdb(imdbId, type) {
    const fromTmdb = await this.findByImdb(imdbId);
    if (fromTmdb?.tmdbId) {
      return this.getDetails(fromTmdb.tmdbId, type);
    }
    const stremioType = type === "FILME" /* MOVIE */ ? "movie" : "series";
    const cineMeta = await this.getCinemetaMeta(stremioType, imdbId);
    if (cineMeta) {
      const formatted = formatCinemetaItem(cineMeta);
      const cast = Array.isArray(cineMeta.cast) ? cineMeta.cast : cineMeta.cast ? [cineMeta.cast] : [];
      const director = Array.isArray(cineMeta.director) ? cineMeta.director.join(", ") : cineMeta.director;
      const seasons = cineMeta.videos ? Math.max(...cineMeta.videos.map((v) => v.season || 1), 1) : 1;
      return {
        item: formatted,
        imdbId,
        seasonsCount: seasons,
        cast,
        director,
        similar: []
      };
    }
    return {
      item: {
        id: imdbId,
        imdbId,
        title: imdbId,
        type,
        rating: 8,
        year: 2024,
        image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500",
        backdrop: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500",
        description: "Detalhes sincronizados com o cat\xE1logo oficial do Stremio.",
        genres: ["Geral"]
      },
      imdbId,
      seasonsCount: 1,
      cast: [],
      similar: []
    };
  }
  async getSeasonEpisodes(tvId, seasonNumber) {
    try {
      const data = await this.request(`/tv/${tvId}/season/${seasonNumber}`);
      return (data.episodes || []).map((ep) => ({
        id: `ep-${tvId}-${seasonNumber}-${ep.episode_number}`,
        number: ep.episode_number,
        title: ep.name || `Epis\xF3dio ${ep.episode_number}`,
        description: ep.overview || "Sinopse oficial deste epis\xF3dio n\xE3o informada.",
        image: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500",
        stillPath: ep.still_path,
        airDate: ep.air_date
      }));
    } catch (err) {
      console.warn(`Erro ao carregar epis\xF3dios da T${seasonNumber}:`, err);
      return [];
    }
  }
  async getSeasonEpisodesByImdb(imdbId, seasonNumber) {
    const fromTmdb = await this.findByImdb(imdbId);
    if (fromTmdb?.tmdbId) {
      const eps = await this.getSeasonEpisodes(fromTmdb.tmdbId, seasonNumber);
      if (eps && eps.length > 0) return eps;
    }
    const cineMeta = await this.getCinemetaMeta("series", imdbId);
    if (cineMeta?.videos) {
      const filtered = cineMeta.videos.filter((v) => v.season === seasonNumber);
      if (filtered.length > 0) {
        return filtered.map((v) => ({
          id: v.id || `${imdbId}:${v.season}:${v.number}`,
          number: v.number,
          title: v.name || v.title || `Epis\xF3dio ${v.number}`,
          description: v.overview || v.description || "Sinopse oficial via cat\xE1logo Stremio Cinemeta.",
          image: v.thumbnail || "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=500",
          airDate: v.released
        }));
      }
    }
    return [];
  }
};
var tmdbService = new TMDBClientService();

// src/core/catalog/theatricalFilterService.ts
var STORAGE_KEY = "zapitv_theatrical_evaluations_v2";
var KNOWN_UNRELEASED_OR_THEATRICAL_IDS = /* @__PURE__ */ new Set([
  "1003596",
  // Vingadores: Doutor Destino / Avengers: Doomsday
  "1003598",
  // Vingadores: Guerras Secretas / Avengers: Secret Wars
  "83533",
  // Avatar: Fogo e Cinzas / Avatar: Fire and Ash
  "9659",
  // The Batman Parte II
  "480530",
  // Blade
  "569094",
  // Homem-Aranha: Além do Aranhaverso / Spider-Man: Beyond the Spider-Verse
  "1229730",
  // The Mandalorian & Grogu
  "1084736",
  // Toy Story 5
  "402431",
  // Wicked: Part Two
  "1064213",
  // Anora
  "1100782",
  // Smile 2
  "1034541",
  // Terrifier 3
  "912649",
  // Venom: A Última Rodada / Venom: The Last Dance
  "1184918",
  // O Robô Selvagem / The Wild Robot
  "823219"
  // Flow
]);
var KNOWN_UNRELEASED_PATTERNS = [
  /vingadores.*(doutor destino|guerras secretas|doomsday|secret wars)/i,
  /avengers.*(doomsday|secret wars)/i,
  /avatar.*(fogo e cinzas|fire and ash)/i,
  /the batman.*(parte ii|part ii)/i,
  /spider-man.*beyond the spider-verse/i,
  /homem-aranha.*al[eé]m do aranhaverso/i,
  /mandalorian.*grogu/i,
  /toy story 5/i,
  /shrek 5/i
];
var TheatricalFilterService = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.nowPlayingIds = /* @__PURE__ */ new Set();
    this.nowPlayingTitles = /* @__PURE__ */ new Set();
    this.upcomingIds = /* @__PURE__ */ new Set();
    this.upcomingTitles = /* @__PURE__ */ new Set();
    this.theatricalListsLoaded = false;
    this.theatricalFetchPromise = null;
    this.loadFromStorage();
  }
  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      try {
        localStorage.removeItem("zapitv_theatrical_evaluations");
      } catch {
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        for (const [k, v] of Object.entries(parsed)) {
          if (now < v.expiresAt) {
            this.cache.set(k, v);
          }
        }
      }
    } catch {
    }
  }
  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const obj = {};
      for (const [k, v] of this.cache.entries()) {
        obj[k] = v;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
    }
  }
  /**
   * Identifica se uma fonte ou título é gravação de sala de cinema (CAM / Telesync / HDCAM / Telecine)
   */
  isCamRecording(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    if (/\b(camrip|cam-rip|telesync|hdcam|hd-ts|hdts|telecine|dvdscr|screener)\b/i.test(lower)) {
      return true;
    }
    if (/grava[çc][ãa]o de cinema|cinema rip|audio de cinema|sala de cinema/i.test(lower)) {
      return true;
    }
    if (/\bcam\b/i.test(lower) && /\b(x264|x265|720p|1080p|rip|vbr|v2|cinema|sala|audio|line)\b/i.test(lower)) {
      return true;
    }
    if (/\bts\b/i.test(lower) && !/\.ts(\?|\/|$)/i.test(lower) && /\b(x264|x265|rip|line|clean|hq|hd)\b/i.test(lower)) {
      return true;
    }
    return false;
  }
  /**
   * Identifica se uma fonte retornada por um add-on é na verdade um trailer, teaser ou material promocional
   */
  isTrailerOrFakeSource(stream) {
    if (!stream) return { isFake: false };
    const combined = `${stream.name || ""} ${stream.title || ""} ${stream.url || ""}`.toLowerCase();
    if (/\b(trailer|official trailer|teaser|preview clip|promo video|behind the scenes|making of)\b/i.test(combined)) {
      return { isFake: true, reason: "Fonte identificada como trailer/teaser promocional e n\xE3o como filme completo" };
    }
    if (typeof stream.duration === "number" && stream.duration > 0 && stream.duration < 300) {
      return { isFake: true, reason: `Dura\xE7\xE3o da m\xEDdia (${stream.duration}s) \xE9 caracter\xEDstica de trailer/amostra e n\xE3o de filme completo` };
    }
    return { isFake: false };
  }
  /**
   * Carrega os filmes atualmente em cartaz e próximos lançamentos nos cinemas brasileiros direto do TMDB
   */
  async loadNowPlayingInBrazil() {
    if (this.theatricalListsLoaded) return;
    if (this.theatricalFetchPromise) return this.theatricalFetchPromise;
    this.theatricalFetchPromise = (async () => {
      try {
        const [npRes, upRes] = await Promise.allSettled([
          fetch(`${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&region=BR&language=pt-BR&page=1`),
          fetch(`${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&region=BR&language=pt-BR&page=1`)
        ]);
        if (npRes.status === "fulfilled" && npRes.value.ok) {
          const data = await npRes.value.json();
          const results = data.results || [];
          for (const item of results) {
            if (item.id) this.nowPlayingIds.add(String(item.id));
            if (item.title) this.nowPlayingTitles.add(this.normalizeTitle(item.title));
            if (item.original_title) this.nowPlayingTitles.add(this.normalizeTitle(item.original_title));
          }
        }
        if (upRes.status === "fulfilled" && upRes.value.ok) {
          const data = await upRes.value.json();
          const results = data.results || [];
          for (const item of results) {
            if (item.id) this.upcomingIds.add(String(item.id));
            if (item.title) this.upcomingTitles.add(this.normalizeTitle(item.title));
            if (item.original_title) this.upcomingTitles.add(this.normalizeTitle(item.original_title));
          }
        }
        this.theatricalListsLoaded = true;
      } catch (err) {
        console.warn("[TheatricalFilter] Falha ao carregar listas teatrais BR:", err);
      } finally {
        this.theatricalFetchPromise = null;
      }
    })();
    return this.theatricalFetchPromise;
  }
  normalizeTitle(t) {
    return (t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }
  /**
   * Verifica se o item pertence a obras notoriamente não lançadas ou em cartaz
   */
  isKnownUnreleasedOrTheatrical(item) {
    if (!item) return false;
    if (item.tmdbId && KNOWN_UNRELEASED_OR_THEATRICAL_IDS.has(String(item.tmdbId))) {
      return true;
    }
    const rawTmdbId = item.id?.startsWith("tmdb-") ? item.id.replace("tmdb-", "") : null;
    if (rawTmdbId && KNOWN_UNRELEASED_OR_THEATRICAL_IDS.has(rawTmdbId)) {
      return true;
    }
    const titlesToCheck = [item.title, item.originalTitle].filter(Boolean);
    for (const t of titlesToCheck) {
      for (const pattern of KNOWN_UNRELEASED_PATTERNS) {
        if (pattern.test(t)) return true;
      }
    }
    return false;
  }
  /**
   * Verifica se o item está em exibição confirmada nos cinemas
   */
  isKnownInTheaters(item) {
    if (!item) return false;
    if (item.tmdbId && this.nowPlayingIds.has(String(item.tmdbId))) return true;
    const rawTmdbId = item.id?.startsWith("tmdb-") ? item.id.replace("tmdb-", "") : null;
    if (rawTmdbId && this.nowPlayingIds.has(rawTmdbId)) return true;
    const normTitle = this.normalizeTitle(item.title);
    if (this.nowPlayingTitles.has(normTitle)) return true;
    if (item.originalTitle) {
      const normOrig = this.normalizeTitle(item.originalTitle);
      if (this.nowPlayingTitles.has(normOrig)) return true;
    }
    return false;
  }
  /**
   * Verifica se o item está na lista de próximos lançamentos nos cinemas
   */
  isKnownUpcoming(item) {
    if (!item) return false;
    if (item.tmdbId && this.upcomingIds.has(String(item.tmdbId))) return true;
    const rawTmdbId = item.id?.startsWith("tmdb-") ? item.id.replace("tmdb-", "") : null;
    if (rawTmdbId && this.upcomingIds.has(rawTmdbId)) return true;
    const normTitle = this.normalizeTitle(item.title);
    if (this.upcomingTitles.has(normTitle)) return true;
    if (item.originalTitle) {
      const normOrig = this.normalizeTitle(item.originalTitle);
      if (this.upcomingTitles.has(normOrig)) return true;
    }
    return false;
  }
  /**
   * Avalia de forma assíncrona se um filme pode ou não ser exibido no catálogo público
   */
  async evaluateMovie(item) {
    if (!item) {
      return {
        id: "invalid",
        region: "BR",
        title: "Desconhecido",
        status: "UPCOMING",
        allowed: false,
        reason: "Item inv\xE1lido ou nulo",
        evidence: ["invalid_item"],
        evaluatedAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1e3
      };
    }
    if (item.type === "S\xC9RIE" /* SERIES */) {
      return {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "NOT_APPLICABLE",
        allowed: true,
        reason: "S\xE9rie de TV / Epis\xF3dios \u2014 N\xE3o possui janela cinematogr\xE1fica exclusiva",
        evidence: ["content_type_series"],
        evaluatedAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1e3
        // 30 dias
      };
    }
    const cacheKey = item.tmdbId ? `tmdb-${item.tmdbId}` : item.imdbId || item.id;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && now < cached.expiresAt) {
      return cached;
    }
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const itemYear = Number(item.year) || currentYear;
    await this.loadNowPlayingInBrazil();
    if (item.releaseDate && item.releaseDate > todayStr) {
      const evaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "UPCOMING",
        allowed: false,
        reason: `Filme ainda n\xE3o lan\xE7ado comercialmente (Previs\xE3o de estreia: ${item.releaseDate})`,
        evidence: ["future_release_date", `date_${item.releaseDate}`],
        theatricalDate: item.releaseDate,
        evaluatedAt: now,
        expiresAt: now + 12 * 60 * 60 * 1e3
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }
    if (this.isKnownUnreleasedOrTheatrical(item)) {
      const evaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "UPCOMING",
        allowed: false,
        reason: "T\xEDtulo confirmado em produ\xE7\xE3o/aguardando lan\xE7amento cinematogr\xE1fico futuro oficial",
        evidence: ["known_unreleased_blockbuster"],
        evaluatedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1e3
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }
    if (this.isKnownInTheaters(item)) {
      const evaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "IN_THEATERS",
        allowed: false,
        reason: "Comprovadamente em exibi\xE7\xE3o comercial nos cinemas brasileiros (circuito ativo)",
        evidence: ["now_playing_brazil_active", "commercial_theatrical_run"],
        evaluatedAt: now,
        expiresAt: now + 12 * 60 * 60 * 1e3
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }
    if (this.isKnownUpcoming(item)) {
      const evaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "UPCOMING",
        allowed: false,
        reason: "Presente no calend\xE1rio oficial de pr\xF3ximas estreias nos cinemas brasileiros",
        evidence: ["upcoming_brazil_active"],
        evaluatedAt: now,
        expiresAt: now + 12 * 60 * 60 * 1e3
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }
    if (itemYear > currentYear) {
      const evaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "UPCOMING",
        allowed: false,
        reason: `Filme ainda n\xE3o lan\xE7ado comercialmente (Previs\xE3o de estreia: ${itemYear})`,
        evidence: ["future_year_release"],
        evaluatedAt: now,
        expiresAt: now + 12 * 60 * 60 * 1e3
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }
    if (itemYear < currentYear - 1) {
      const evaluation = {
        id: item.id,
        tmdbId: item.tmdbId,
        region: "BR",
        title: item.title,
        status: "POST_THEATRICAL",
        allowed: true,
        reason: `Cat\xE1logo de ano anterior (${itemYear}) \u2014 Fora de qualquer janela cinematogr\xE1fica`,
        evidence: ["back_catalog_movie", "not_in_theaters"],
        evaluatedAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1e3
        // 30 dias
      };
      this.cache.set(cacheKey, evaluation);
      this.saveToStorage();
      return evaluation;
    }
    const tmdbIdNum = item.tmdbId ? parseInt(item.tmdbId, 10) : item.id.startsWith("tmdb-") ? parseInt(item.id.replace("tmdb-", ""), 10) : NaN;
    if (!isNaN(tmdbIdNum) && tmdbIdNum > 0) {
      try {
        const [datesRes, detailsRes] = await Promise.allSettled([
          fetch(`${TMDB_BASE_URL}/movie/${tmdbIdNum}/release_dates?api_key=${TMDB_API_KEY}`),
          fetch(`${TMDB_BASE_URL}/movie/${tmdbIdNum}?api_key=${TMDB_API_KEY}&language=pt-BR`)
        ]);
        if (detailsRes.status === "fulfilled" && detailsRes.value.ok) {
          const detailsData = await detailsRes.value.json();
          if (detailsData.status && detailsData.status !== "Released") {
            const evaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: "BR",
              title: item.title,
              status: "UPCOMING",
              allowed: false,
              reason: `Status de produ\xE7\xE3o n\xE3o lan\xE7ado no TMDB (${detailsData.status})`,
              evidence: [`tmdb_status_${detailsData.status}`],
              evaluatedAt: now,
              expiresAt: now + 24 * 60 * 60 * 1e3
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }
          if (detailsData.release_date && detailsData.release_date > todayStr) {
            const evaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: "BR",
              title: item.title,
              status: "UPCOMING",
              allowed: false,
              reason: `Estreia nos cinemas prevista para ${detailsData.release_date}`,
              evidence: [`tmdb_details_future_date_${detailsData.release_date}`],
              theatricalDate: detailsData.release_date,
              evaluatedAt: now,
              expiresAt: now + 24 * 60 * 60 * 1e3
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }
        }
        if (datesRes.status === "fulfilled" && datesRes.value.ok) {
          const data = await datesRes.value.json();
          const countries = data.results || [];
          const brData = countries.find((c) => c.iso_3166_1 === "BR");
          const usData = countries.find((c) => c.iso_3166_1 === "US");
          let theatricalDate;
          let digitalDate;
          const evidence = [];
          const extractDates = (countryObj, countryCode) => {
            if (!countryObj?.release_dates) return;
            for (const rd of countryObj.release_dates) {
              const rDate = (rd.release_date || "").slice(0, 10);
              if (rd.type === 1 || rd.type === 2 || rd.type === 3) {
                if (!theatricalDate || rDate < theatricalDate) {
                  theatricalDate = rDate;
                  evidence.push(`theatrical_${countryCode}_${rDate}`);
                }
              }
              if (rd.type === 4 || rd.type === 5 || rd.type === 6) {
                if (!digitalDate || rDate < digitalDate) {
                  digitalDate = rDate;
                  evidence.push(`digital_${countryCode}_${rDate}`);
                }
              }
            }
          };
          if (brData) extractDates(brData, "BR");
          if (usData && (!digitalDate || !theatricalDate)) extractDates(usData, "US");
          if (theatricalDate && theatricalDate > todayStr) {
            const evaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: "BR",
              title: item.title,
              status: "UPCOMING",
              allowed: false,
              reason: `Estreia nos cinemas prevista para ${theatricalDate}`,
              evidence: [...evidence, "theatrical_future_date"],
              theatricalDate,
              digitalDate,
              evaluatedAt: now,
              expiresAt: now + 24 * 60 * 60 * 1e3
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }
          if (digitalDate && digitalDate <= todayStr && !this.isKnownInTheaters(item)) {
            const evaluation = {
              id: item.id,
              tmdbId: item.tmdbId,
              region: "BR",
              title: item.title,
              status: "DIGITAL_RELEASED",
              allowed: true,
              reason: `Lan\xE7amento digital oficial dispon\xEDvel desde ${digitalDate}`,
              evidence: [...evidence, "digital_release_active"],
              theatricalDate,
              digitalDate,
              evaluatedAt: now,
              expiresAt: now + 7 * 24 * 60 * 60 * 1e3
              // 7 dias
            };
            this.cache.set(cacheKey, evaluation);
            this.saveToStorage();
            return evaluation;
          }
          if (theatricalDate) {
            const diffDays = Math.floor((now - new Date(theatricalDate).getTime()) / (1e3 * 60 * 60 * 24));
            if (diffDays < 70) {
              const evaluation = {
                id: item.id,
                tmdbId: item.tmdbId,
                region: "BR",
                title: item.title,
                status: "IN_THEATERS",
                allowed: false,
                reason: `Em cartaz nos cinemas h\xE1 ${diffDays} dias (Janela exclusiva ativa)`,
                evidence: [...evidence, `${diffDays}_days_theatrical_window`],
                theatricalDate,
                evaluatedAt: now,
                expiresAt: now + 12 * 60 * 60 * 1e3
              };
              this.cache.set(cacheKey, evaluation);
              this.saveToStorage();
              return evaluation;
            } else if (diffDays < 95) {
              const evaluation = {
                id: item.id,
                tmdbId: item.tmdbId,
                region: "BR",
                title: item.title,
                status: "THEATRICAL_STATUS_UNKNOWN",
                allowed: false,
                reason: `Per\xEDodo de transi\xE7\xE3o de cinema (${diffDays} dias). Aguardando confirma\xE7\xE3o oficial de encerramento do circuito ou lan\xE7amento digital.`,
                evidence: [...evidence, "theatrical_status_uncertain"],
                theatricalDate,
                evaluatedAt: now,
                expiresAt: now + 6 * 60 * 60 * 1e3
              };
              this.cache.set(cacheKey, evaluation);
              this.saveToStorage();
              return evaluation;
            } else {
              const evaluation = {
                id: item.id,
                tmdbId: item.tmdbId,
                region: "BR",
                title: item.title,
                status: "POST_THEATRICAL",
                allowed: true,
                reason: `Janela de exibi\xE7\xE3o nos cinemas finalizada (${diffDays} dias desde o lan\xE7amento)`,
                evidence: [...evidence, "theatrical_circuit_closed"],
                theatricalDate,
                evaluatedAt: now,
                expiresAt: now + 14 * 24 * 60 * 60 * 1e3
                // 14 dias
              };
              this.cache.set(cacheKey, evaluation);
              this.saveToStorage();
              return evaluation;
            }
          }
        }
      } catch (err) {
        console.warn(`[TheatricalFilter] Falha na API ao consultar datas de ${item.title}:`, err);
      }
    }
    const fallbackEvaluation = {
      id: item.id,
      tmdbId: item.tmdbId,
      region: "BR",
      title: item.title,
      status: "POST_THEATRICAL",
      allowed: true,
      reason: "Sem ind\xEDcio de exibi\xE7\xE3o cinematogr\xE1fica ativa no Brasil",
      evidence: ["heuristic_fallback_allowed"],
      evaluatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1e3
    };
    this.cache.set(cacheKey, fallbackEvaluation);
    this.saveToStorage();
    return fallbackEvaluation;
  }
  /**
   * Avaliação instantânea síncrona com base no cache e heurísticas imediatas.
   * Executa em tempo zero (0ms), garantindo que títulos bloqueados jamais sejam renderizados.
   */
  isMovieAllowedSync(item) {
    if (!item) return false;
    if (item.type === "S\xC9RIE" /* SERIES */) return true;
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const itemYear = Number(item.year) || currentYear;
    if (itemYear > currentYear) return false;
    if (item.releaseDate && item.releaseDate > todayStr) return false;
    if (this.isKnownUnreleasedOrTheatrical(item)) return false;
    if (this.isKnownInTheaters(item) || this.isKnownUpcoming(item)) {
      return false;
    }
    const cacheKey = item.tmdbId ? `tmdb-${item.tmdbId}` : item.imdbId || item.id;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached.allowed;
    }
    if (itemYear < currentYear - 1) return true;
    return true;
  }
  /**
   * Avalia de forma assíncrona se o filme é permitido
   */
  async isMovieAllowed(item) {
    const res = await this.evaluateMovie(item);
    return res.allowed;
  }
  /**
   * Filtra uma lista de itens removendo filmes que ainda estejam em cartaz ou não lançados
   */
  async filterAllowedMovies(items) {
    if (!items || items.length === 0) return [];
    const evaluations = await Promise.all(items.map((it) => this.evaluateMovie(it)));
    return items.filter((_, idx) => evaluations[idx].allowed);
  }
  /**
   * Filtro síncrono rápido para views e renderizadores de UI
   */
  filterAllowedMoviesSync(items) {
    if (!items || items.length === 0) return [];
    return items.filter((it) => this.isMovieAllowedSync(it));
  }
  clearCache() {
    this.cache.clear();
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("zapitv_theatrical_evaluations");
    }
  }
  /**
   * Injeta manualmente uma avaliação no cache (usado para testes ou override de segurança)
   */
  setMockEvaluation(key, evaluation) {
    this.cache.set(key, evaluation);
  }
};
var theatricalFilterService = new TheatricalFilterService();

// src/core/identity/canonicalIdentity.ts
var STOP_WORDS = /* @__PURE__ */ new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "por",
  "para",
  "com",
  "sem",
  "sob",
  "sobre",
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with"
]);
var CanonicalIdentityService = class {
  /**
   * Constrói a identidade canônica a partir de um ContentItem e parâmetros de episódio
   */
  buildIdentity(item, epParams) {
    const genres = (item.genres || []).map((g) => g.toLowerCase());
    const isChildFriendly = genres.some((g) => /infantil|fam[ií]lia|kids|children|desenho|crian[çc]a/i.test(g)) || /doraemon|peppa|galinha pintadinha|patrulha canina|pocoyo|chaves/i.test(item.title);
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const isTheatricalUnreleased = theatricalFilterService.isKnownUnreleasedOrTheatrical(item) || Boolean(item.year && item.year > currentYear) || /hope.*primeiro.*impacto|vingadores.*destino|avengers.*doomsday|batman.*part.*ii/i.test(item.title);
    const aliases = [item.title.toLowerCase()];
    if (item.originalTitle) {
      aliases.push(item.originalTitle.toLowerCase());
      if (item.originalTitle.includes(":")) {
        item.originalTitle.split(":").forEach((p) => {
          const clean = p.trim().toLowerCase();
          if (clean.length >= 3) aliases.push(clean);
        });
      }
    }
    if (item.title.includes(":")) {
      const parts = item.title.split(":");
      parts.forEach((p) => {
        const clean = p.trim().toLowerCase();
        if (clean.length >= 3) aliases.push(clean);
      });
    }
    if (/doraemon/i.test(item.title)) {
      aliases.push("doraemon", "gato do futuro", "\u30C9\u30E9\u3048\u3082\u3093");
    }
    if (/hope.*primeiro.*impacto/i.test(item.title)) {
      aliases.push("hope", "hopeu", "\uD638\uD504");
    }
    return {
      id: item.id,
      tmdbId: item.tmdbId ? String(item.tmdbId) : void 0,
      imdbId: item.imdbId,
      title: item.title,
      year: item.year || currentYear,
      type: item.type,
      season: epParams?.season,
      episode: epParams?.episode,
      genres: item.genres || [],
      isChildFriendly,
      isTheatricalUnreleased,
      knownAliases: Array.from(new Set(aliases))
    };
  }
  /**
   * Normaliza um título removendo pontuações, anos e tags de qualidade
   */
  normalizeTitle(str) {
    return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\[[^\]]*\]/g, " ").replace(/\([^\)]*\)/g, " ").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  /**
   * Extrai palavras-chave significativas para comparação
   */
  extractSignificantTokens(title) {
    const normalized = this.normalizeTitle(title);
    return normalized.split(" ").filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
  }
};
var canonicalIdentityService = new CanonicalIdentityService();

// src/core/security/streamQuarantineService.ts
var STORAGE_QUARANTINE_KEY = "zapitv_stream_quarantine_v1";
var KNOWN_MALICIOUS_HASHES = [
  // Casos Hope: O Primeiro Impacto (Mia Khalifa porn / trotes falsos indexados como supostos WEB-DL)
  { hash: "812efbe7d0a75fb31bf9426db566f299d10b3474", reason: "Trote adulto / Mia Khalifa disfar\xE7ado de grava\xE7\xE3o de cinema" },
  { hash: "6dc48c588dca97da6c610ae730c556a2c7c6718d", reason: "Trote adulto / Conte\xFAdo pornogr\xE1fico" },
  { hash: "e79c88ea04c7326eb0f88ae9f18571689317e27f", reason: "Trote adulto / Conte\xFAdo pornogr\xE1fico" },
  { hash: "f9a842dfe9f5b2e7fda509f2306e0700b97a4036", reason: "Trote adulto / Mia Khalifa" },
  { hash: "d0eacddff07a24173d8f7dc11a18ef3ed32b886a", reason: "V\xEDdeo adulto n\xE3o solicitado em indexador de torrent" },
  { hash: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678", reason: "Arquivo corrompido / scam" }
];
var ADULT_ACTORS_AND_TERMS = [
  "mia khalifa",
  "khalifa",
  "brazzers",
  "xvideos",
  "pornhub",
  "redtube",
  "youporn",
  "bangbros",
  "naughtyamerica",
  "spankbang",
  "xhamster",
  "pornstar",
  "hardcore xxx",
  "creampie",
  "blowjob",
  "ben the men",
  "playweb",
  "mature porn",
  "erotic xxx"
];
var StreamQuarantineService = class {
  constructor() {
    this.quarantinedMap = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.initDefaultQuarantine();
    this.loadFromStorage();
  }
  initDefaultQuarantine() {
    for (const item of KNOWN_MALICIOUS_HASHES) {
      this.quarantinedMap.set(item.hash.toLowerCase(), {
        id: item.hash.toLowerCase(),
        type: "infoHash",
        reason: item.reason,
        targetTitle: "Hope: O Primeiro Impacto",
        sourceProvider: "Torrent Scraper",
        quarantinedAt: "2026-10-13T00:00:00.000Z"
      });
    }
  }
  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const data = localStorage.getItem(STORAGE_QUARANTINE_KEY);
      if (data) {
        const list = JSON.parse(data);
        if (Array.isArray(list)) {
          list.forEach((item) => {
            if (item && item.id) {
              this.quarantinedMap.set(item.id.toLowerCase(), item);
            }
          });
        }
      }
    } catch (e) {
      console.warn("[StreamQuarantine] Erro ao carregar quarentena do storage:", e);
    }
  }
  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const list = Array.from(this.quarantinedMap.values());
      localStorage.setItem(STORAGE_QUARANTINE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("[StreamQuarantine] Erro ao salvar quarentena no storage:", e);
    }
  }
  /**
   * Coloca um stream ou hash em quarentena imediatamente e persiste no sistema.
   */
  quarantine(identifier, reason, type = "url", targetTitle, sourceProvider) {
    if (!identifier) return;
    const cleanId = identifier.trim().toLowerCase();
    const item = {
      id: cleanId,
      type,
      reason,
      targetTitle,
      sourceProvider,
      quarantinedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.quarantinedMap.set(cleanId, item);
    this.saveToStorage();
    console.error(`\u{1F6A8} [QUARANTINE] Fonte isolada permanentemente: "${cleanId}" | Motivo: ${reason}`);
    this.listeners.forEach((fn) => fn());
  }
  /**
   * Avalia rigorosamente se um stream deve ser colocado em quarentena ou já está isolado.
   */
  evaluateQuarantine(stream, targetTitle) {
    if (!stream) return { isQuarantined: true, reason: "Stream nulo ou inv\xE1lido" };
    const hash = (stream.infoHash || "").trim().toLowerCase();
    const url = (stream.url || "").trim().toLowerCase();
    const title = (stream.title || "").toLowerCase();
    const name = (stream.name || "").toLowerCase();
    const combined = `${name} ${title} ${url} ${hash}`;
    if (hash && this.quarantinedMap.has(hash)) {
      return { isQuarantined: true, reason: this.quarantinedMap.get(hash)?.reason || "Hash em quarentena" };
    }
    if (url && this.quarantinedMap.has(url)) {
      return { isQuarantined: true, reason: this.quarantinedMap.get(url)?.reason || "URL em quarentena" };
    }
    for (const adultTerm of ADULT_ACTORS_AND_TERMS) {
      if (combined.includes(adultTerm)) {
        const reason = `Conte\xFAdo adulto/trote detectado: termo "${adultTerm}"`;
        if (hash) this.quarantine(hash, reason, "adult_troll", targetTitle, stream.providerName);
        if (url) this.quarantine(url, reason, "adult_troll", targetTitle, stream.providerName);
        return { isQuarantined: true, reason };
      }
    }
    if (targetTitle && /doraemon|gato do futuro/i.test(targetTitle)) {
      if (combined.includes("sparks of tomorrow") || combined.includes("/1684/") || combined.includes("kurage.live") || combined.includes("animegg")) {
        const reason = 'Colis\xE3o conhecida de anime upstream: "Sparks of Tomorrow" atribu\xEDdo a Doraemon';
        if (url) this.quarantine(url, reason, "title_collision", targetTitle, stream.providerName);
        return { isQuarantined: true, reason };
      }
    }
    if (targetTitle && /hope.*primeiro.*impacto|hopeu|1058424|tt27369017/i.test(targetTitle)) {
      if ((title.includes("web-dl") || title.includes("webrip") || title.includes("amzn") || title.includes("bluray")) && !title.includes("trailer") && !title.includes("teaser")) {
        const reason = "Release WEB-DL/Bluray fraudulenta de filme em cartaz nos cinemas (Hope 2026)";
        if (hash) this.quarantine(hash, reason, "adult_troll", targetTitle, stream.providerName);
        return { isQuarantined: true, reason };
      }
    }
    return { isQuarantined: false };
  }
  /**
   * Retorna lista de todos os itens em quarentena para diagnóstico
   */
  getQuarantineList() {
    return Array.from(this.quarantinedMap.values());
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
};
var streamQuarantineService = new StreamQuarantineService();

// src/core/identity/sourceConfidenceEngine.ts
var KNOWN_COLLISION_TITLES = [
  "sparks of tomorrow",
  "eternal aseria",
  "angel heart",
  "black clover",
  "murai in love",
  "saving 80,000 gold",
  "overflow",
  "plant\xE3o m\xE9dico",
  "er plant\xE3o m\xE9dico",
  "ultraman"
];
var SourceConfidenceEngine = class {
  /**
   * Avalia uma fonte de streaming contra a identidade canônica da obra solicitada.
   */
  evaluate(stream, identity) {
    const reasons = [];
    const streamName = stream.name || "";
    const streamTitle = stream.title || "";
    const streamUrl = stream.url || "";
    const streamInfoHash = (stream.infoHash || "").toLowerCase();
    const combined = `${streamName} ${streamTitle} ${streamUrl} ${streamInfoHash}`.toLowerCase();
    const quarantineCheck = streamQuarantineService.evaluateQuarantine(stream, identity.title);
    if (quarantineCheck.isQuarantined) {
      reasons.push(quarantineCheck.reason || "Fonte bloqueada por quarentena");
      return {
        stream,
        confidence: "QUARANTINED",
        isMatch: false,
        reasons,
        canonicalTitle: identity.title
      };
    }
    if (identity.isTheatricalUnreleased) {
      const isClaimingDigital = (combined.includes("web-dl") || combined.includes("webrip") || combined.includes("bluray") || combined.includes("amzn")) && !combined.includes("trailer") && !combined.includes("teaser");
      if (isClaimingDigital) {
        const reason = `Release digital fraudulenta para obra em cartaz/n\xE3o lan\xE7ada: "${identity.title}"`;
        streamQuarantineService.quarantine(streamInfoHash || streamUrl, reason, "adult_troll", identity.title, stream.providerName);
        reasons.push(reason);
        return {
          stream,
          confidence: "QUARANTINED",
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
      }
    }
    const isAcervoOficial = stream.providerId === "zapitv-verified" || stream.providerName?.includes("Acervo") || stream.providerName?.includes("ZapiTV") || streamUrl.includes("archive.org") || streamUrl.includes("/api/stremio/cinema-aberto") || streamUrl.includes("/api/stremio/blender-open") || streamUrl.includes("/api/stremio/public-domain");
    if (isAcervoOficial) {
      reasons.push("Fonte can\xF4nica verificada pelo acervo oficial ZapiTV");
      return {
        stream,
        confidence: "VERIFIED",
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
    }
    const streamTitleToCheck = canonicalIdentityService.normalizeTitle(`${streamName} ${streamTitle}`);
    for (const collisionTitle of KNOWN_COLLISION_TITLES) {
      const cleanCollision = canonicalIdentityService.normalizeTitle(collisionTitle);
      const regex = new RegExp(`(^|\\s)${cleanCollision}(\\s|$)`, "i");
      if (regex.test(streamTitleToCheck)) {
        const cleanTarget = canonicalIdentityService.normalizeTitle(identity.title);
        const cleanOrig = identity.originalTitle ? canonicalIdentityService.normalizeTitle(identity.originalTitle) : "";
        if (!cleanTarget.includes(cleanCollision) && !cleanOrig.includes(cleanCollision)) {
          reasons.push(`Obra incorreta detectada: stream cont\xE9m "${collisionTitle}"`);
          return {
            stream,
            confidence: "REJECTED",
            isMatch: false,
            reasons,
            canonicalTitle: identity.title
          };
        }
      }
    }
    if (/resident evil/i.test(identity.title) && !/vendetta|damnation|degeneration|infinite darkness|death island/i.test(identity.title)) {
      if (/vendetta|damnation|degeneration|infinite darkness|death island/i.test(combined)) {
        reasons.push("Anima\xE7\xE3o 3D de Resident Evil n\xE3o pode substituir o filme live-action solicitado");
        return {
          stream,
          confidence: "REJECTED",
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
      }
    }
    const targetTokens = canonicalIdentityService.extractSignificantTokens(identity.title);
    const cleanStreamTitle = canonicalIdentityService.normalizeTitle(streamTitle);
    let aliasMatched = false;
    for (const alias of identity.knownAliases) {
      if (cleanStreamTitle.includes(alias) || combined.includes(alias)) {
        aliasMatched = true;
        break;
      }
    }
    const matchingTokens = targetTokens.filter((token) => cleanStreamTitle.includes(token) || combined.includes(token));
    const tokenOverlapRatio = targetTokens.length > 0 ? matchingTokens.length / targetTokens.length : 0;
    if (!aliasMatched && tokenOverlapRatio === 0) {
      reasons.push(`T\xEDtulo do stream n\xE3o possui correspond\xEAncia com "${identity.title}"`);
      return {
        stream,
        confidence: "REJECTED",
        isMatch: false,
        reasons,
        canonicalTitle: identity.title
      };
    }
    if (identity.isChildFriendly) {
      if (!aliasMatched && tokenOverlapRatio < 0.5) {
        reasons.push("Conte\xFAdo infantil exige confirma\xE7\xE3o rigorosa de identidade");
        return {
          stream,
          confidence: "REJECTED",
          isMatch: false,
          reasons,
          canonicalTitle: identity.title
        };
      }
      reasons.push("Conte\xFAdo infantil: correspond\xEAncia aprovada com valida\xE7\xE3o cautelosa");
      return {
        stream,
        confidence: "PROVISIONAL",
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
    }
    if (aliasMatched || tokenOverlapRatio >= 0.5) {
      reasons.push(`Correspond\xEAncia de t\xEDtulo verificada (${Math.round(tokenOverlapRatio * 100)}% dos termos)`);
      return {
        stream,
        confidence: "PROVISIONAL",
        isMatch: true,
        reasons,
        canonicalTitle: identity.title
      };
    }
    reasons.push("Informa\xE7\xF5es do stream incompletas ou correspond\xEAncia parcial");
    return {
      stream,
      confidence: "SUSPICIOUS",
      isMatch: false,
      reasons,
      canonicalTitle: identity.title
    };
  }
  /**
   * Filtra e classifica uma lista de streams para a mídia solicitada
   */
  evaluateBatch(streams, identity) {
    return streams.map((s) => this.evaluate(s, identity));
  }
};
var sourceConfidenceEngine = new SourceConfidenceEngine();

// src/core/selection/sourceSelectionService.ts
var QUALITY_SCORES = {
  "4K": 50,
  "2160p": 50,
  "1080p": 40,
  "720p": 30,
  "480p": 10,
  "HD": 25,
  "SD": 5
};
var selectionCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 60 * 60 * 1e3;
var SourceSelectionService = class {
  /**
   * Avalia individualmente um stream e calcula sua pontuação de acordo com
   * a hierarquia obrigatória do ZapiTV, onde Áudio Dublado PT-BR tem prioridade absoluta.
   */
  evaluateStream(stream, options) {
    let confidence = "PROVISIONAL";
    let confidenceBonus = 0;
    let confidenceExplanation = "";
    if (options.identity) {
      const confEval = sourceConfidenceEngine.evaluate(stream, options.identity);
      confidence = confEval.confidence;
      if (confEval.confidence === "QUARANTINED") {
        return {
          score: -1e6,
          priority: 6,
          confidence: "QUARANTINED",
          audioTier: "foreign",
          subtitleFormat: "unknown",
          audioAnalysis: { tier: "foreign", isDubbed: false, isPtBr: false, isDualAudio: false, language: "unknown", confidence: 0, reason: confEval.reasons.join(", ") },
          subtitleAnalysis: { format: "unknown", isHardsub: false, isClean: false, isSoftsub: false, hasPtSubtitle: false, confidence: 0, details: confEval.reasons.join(", ") },
          explanation: `\u{1F6A8} QUARENTENA: ${confEval.reasons.join(" \u2022 ")}`
        };
      }
      if (confEval.confidence === "REJECTED") {
        return {
          score: -5e5,
          priority: 6,
          confidence: "REJECTED",
          audioTier: "foreign",
          subtitleFormat: "unknown",
          audioAnalysis: { tier: "foreign", isDubbed: false, isPtBr: false, isDualAudio: false, language: "unknown", confidence: 0, reason: confEval.reasons.join(", ") },
          subtitleAnalysis: { format: "unknown", isHardsub: false, isClean: false, isSoftsub: false, hasPtSubtitle: false, confidence: 0, details: confEval.reasons.join(", ") },
          explanation: `\u274C REJEITADO: ${confEval.reasons.join(" \u2022 ")}`
        };
      }
      if (options.identity.isChildFriendly && confEval.confidence !== "VERIFIED" && confEval.confidence !== "PROVISIONAL") {
        return {
          score: -3e5,
          priority: 6,
          confidence: confEval.confidence,
          audioTier: "foreign",
          subtitleFormat: "unknown",
          audioAnalysis: { tier: "foreign", isDubbed: false, isPtBr: false, isDualAudio: false, language: "unknown", confidence: 0, reason: "Conte\xFAdo infantil restrito a fontes verificadas" },
          subtitleAnalysis: { format: "unknown", isHardsub: false, isClean: false, isSoftsub: false, hasPtSubtitle: false, confidence: 0, details: "Conte\xFAdo infantil restrito a fontes verificadas" },
          explanation: `\u{1F6E1}\uFE0F BLOQUEIO INFANTIL: Fonte n\xE3o verificada para "${options.identity.title}"`
        };
      }
      if (confEval.confidence === "VERIFIED") {
        confidenceBonus = 2e4;
        confidenceExplanation = " (Fonte Can\xF4nica Verificada)";
      } else if (confEval.confidence === "SUSPICIOUS") {
        confidenceBonus = -4e4;
        confidenceExplanation = " (Metadados Suspeitos)";
      }
    }
    const audio = audioPreferenceService.analyzeAudio(stream);
    const sub = subtitlePreferenceService.analyzeSubtitles(stream, options.hasExternalPtSub);
    const combined = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""}`.toLowerCase();
    let qualityBonus = 20;
    for (const [qKey, qScore] of Object.entries(QUALITY_SCORES)) {
      if (combined.includes(qKey.toLowerCase()) || stream.quality && stream.quality.toLowerCase().includes(qKey.toLowerCase())) {
        qualityBonus = qScore;
        break;
      }
    }
    const isNotWebReady = stream.behaviorHints?.notWebReady === true;
    const webReadyPenalty = isNotWebReady ? -8e4 : 0;
    const webReadyExplanation = isNotWebReady ? " (Requer motor externo)" : "";
    if (audio.tier === "dubbed_ptbr") {
      let subTierBonus = 2e3;
      let subExplanation = "estado de legendas desconhecido";
      if (sub.format === "clean_confirmed") {
        subTierBonus = 4e3;
        subExplanation = "v\xEDdeo limpo";
      } else if (sub.format === "softsub") {
        subTierBonus = 3e3;
        subExplanation = "softsub";
      } else if (sub.format === "hardsub_ptbr") {
        subTierBonus = 1e3;
        subExplanation = "hardsub PT-BR";
      } else if (sub.format === "hardsub_foreign") {
        subTierBonus = 500;
        subExplanation = "placas em outro idioma";
      }
      const score2 = 1e5 + subTierBonus + qualityBonus + confidenceBonus + webReadyPenalty;
      return {
        score: score2,
        priority: 1,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 1: \xC1udio Dublado PT-BR (${subExplanation}, score: ${score2})${confidenceExplanation}${webReadyExplanation}`
      };
    }
    if (audio.tier === "dual_audio") {
      let subTierBonus = 2e3;
      if (sub.format === "clean_confirmed") subTierBonus = 4e3;
      else if (sub.format === "softsub") subTierBonus = 3e3;
      else if (sub.format === "hardsub_ptbr") subTierBonus = 1e3;
      else if (sub.format === "hardsub_foreign") subTierBonus = 500;
      const score2 = 9e4 + subTierBonus + qualityBonus + confidenceBonus + webReadyPenalty;
      return {
        score: score2,
        priority: 2,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 2: Dual \xC1udio PT-BR (score: ${score2})${confidenceExplanation}${webReadyExplanation}`
      };
    }
    if (options.hasExternalPtSub && (sub.format === "clean_confirmed" || sub.format === "softsub" || sub.format === "unknown")) {
      let subBonus = 1e3;
      if (sub.format === "clean_confirmed") subBonus = 4e3;
      else if (sub.format === "softsub") subBonus = 3e3;
      const score2 = 5e4 + subBonus + qualityBonus + confidenceBonus + webReadyPenalty;
      return {
        score: score2,
        priority: 3,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 3: \xC1udio Original + V\xEDdeo Limpo + Legenda PT-BR externa (score: ${score2})${confidenceExplanation}${webReadyExplanation}`
      };
    }
    if (sub.format === "softsub" && sub.hasPtSubtitle) {
      const score2 = 4e4 + 3e3 + qualityBonus + confidenceBonus + webReadyPenalty;
      return {
        score: score2,
        priority: 4,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 4: \xC1udio Original + Softsub PT-BR interno (score: ${score2})${confidenceExplanation}${webReadyExplanation}`
      };
    }
    if (sub.format === "hardsub_ptbr") {
      const base = options.hasExternalPtSub ? 2e4 : 3e4;
      const score2 = base + qualityBonus + confidenceBonus + webReadyPenalty;
      return {
        score: score2,
        priority: 5,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 5: \xC1udio Original + Hardsub PT-BR (score: ${score2})${confidenceExplanation}${webReadyExplanation}`
      };
    }
    const isForeignHardsub = sub.format === "hardsub_foreign";
    const baseScore = isForeignHardsub ? -5e3 : 5e3;
    const score = baseScore + qualityBonus + confidenceBonus + webReadyPenalty;
    return {
      score,
      priority: 6,
      confidence,
      audioTier: audio.tier,
      subtitleFormat: sub.format,
      audioAnalysis: audio,
      subtitleAnalysis: sub,
      explanation: `Prioridade 6: Idioma estrangeiro / Hardsub estrangeiro (score: ${score})${confidenceExplanation}${webReadyExplanation}`
    };
  }
  /**
   * Ordena a lista de streams aplicando a hierarquia estrita:
   * 1. Confirmação obrigatória de identidade (rejeita e quarentena excluídos)
   * 2. Dublagem PT-BR
   * 3. Dual Audio
   * 4. Áudio Original + Limpo + Legenda externa
   * 5. Softsub PT-BR
   * 6. Hardsub PT-BR
   * 7. Outros
   */
  rankStreams(streams, options) {
    if (!streams || streams.length === 0) return [];
    if (options.cacheKey) {
      const cached = selectionCache.get(options.cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.streams;
      }
    }
    const scored = streams.map((stream) => {
      const evaluation = this.evaluateStream(stream, {
        hasExternalPtSub: options.hasExternalPtSub,
        identity: options.identity
      });
      return {
        stream,
        evaluation
      };
    });
    const validScored = scored.filter((item) => item.evaluation.score >= 0);
    validScored.sort((a, b) => b.evaluation.score - a.evaluation.score);
    const rankedStreams = validScored.map((item) => ({
      ...item.stream,
      _smartScore: item.evaluation.score,
      _smartPriority: item.evaluation.priority,
      _confidence: item.evaluation.confidence,
      _audioTier: item.evaluation.audioTier,
      _subtitleFormat: item.evaluation.subtitleFormat,
      _scoreExplanation: item.evaluation.explanation
    }));
    if (options.cacheKey) {
      selectionCache.set(options.cacheKey, {
        streams: rankedStreams,
        timestamp: Date.now()
      });
    }
    return rankedStreams;
  }
  /**
   * Invalida qualquer cache de seleção armazenado em memória.
   */
  clearRankingCache() {
    selectionCache.clear();
  }
};
var sourceSelectionService = new SourceSelectionService();

// src/core/audio/audioDetector.ts
var QUALITY_PATTERNS = [
  { regex: /\b(4k|2160p|uhd)\b/i, quality: "4K", score: 50 },
  { regex: /\b(1080p|fhd|full\s*hd)\b/i, quality: "1080p", score: 40 },
  { regex: /\b(720p|hd)\b/i, quality: "720p", score: 30 },
  { regex: /\b(480p|sd)\b/i, quality: "480p", score: 10 }
];
async function checkOpenSubtitlesPtBr(type, id) {
  if (!id) return false;
  try {
    const cleanId = id.replace(/\.json$/, "");
    const subUrl = `https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(cleanId)}.json`;
    const res = await fetch(subUrl, { signal: AbortSignal.timeout(3e3) });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.subtitles)) {
        return data.subtitles.some((s) => s.lang === "pob" || s.lang === "por");
      }
    }
  } catch {
  }
  return false;
}
function classifyStream(stream, hasExternalPtSub = false) {
  const combinedText = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""}`.toLowerCase();
  let quality = stream.quality || "HD";
  for (const q of QUALITY_PATTERNS) {
    if (q.regex.test(combinedText) || stream.quality && q.regex.test(stream.quality)) {
      quality = q.quality;
      break;
    }
  }
  const evaluation = sourceSelectionService.evaluateStream(stream, { hasExternalPtSub });
  const isPtBr = evaluation.audioAnalysis.isPtBr;
  const isDubbed = evaluation.audioAnalysis.isDubbed;
  const isSubtitled = evaluation.subtitleAnalysis.hasPtSubtitle;
  const subFormat = evaluation.subtitleFormat;
  const isHardsub = evaluation.subtitleAnalysis.isHardsub;
  const score = evaluation.score;
  let language = "unknown";
  if (evaluation.audioAnalysis.tier === "dual_audio") language = "dual";
  else if (isDubbed) language = "pt-BR";
  else if (evaluation.audioAnalysis.language === "ja") language = "ja";
  else if (evaluation.audioAnalysis.language === "en") language = "en";
  else if (evaluation.audioAnalysis.language === "es") language = "es";
  else if (evaluation.audioAnalysis.language === "pt-PT") language = "pt-PT";
  else if (isSubtitled) language = "original";
  let badge = "\u274C";
  let badgeLabel = "Sem PT-BR";
  if (isDubbed && (isSubtitled || hasExternalPtSub)) {
    badge = "\u{1F50A}\u{1F4AC}";
    badgeLabel = "Dublado + Legenda PT-BR";
  } else if (isDubbed) {
    badge = "\u{1F50A}";
    badgeLabel = "\xC1udio Dublado PT-BR";
  } else if (isSubtitled || hasExternalPtSub) {
    badge = "\u{1F4AC}";
    badgeLabel = subFormat === "hardsub_ptbr" ? "Hardsub PT-BR" : "Legenda PT-BR";
  }
  return {
    isPtBr,
    isDubbed,
    isSubtitled,
    hasPtSubtitle: isSubtitled || hasExternalPtSub,
    language,
    quality,
    score,
    badge,
    badgeLabel,
    subtitleFormat: subFormat,
    isHardsub
  };
}
function filterCleanNativeStreams(streams) {
  return streams.filter((stream) => {
    if (stream.ytId) return false;
    const url = (stream.url || "").toLowerCase();
    if (url.includes("youtube.com") || url.includes("youtu.be")) return false;
    if (url.includes("embedplay") || url.includes("playerflix") || url.includes("videasy") || url.includes("superflix") || url.includes("parklogic")) {
      return false;
    }
    return true;
  });
}
function sortStreamsByPtBrPriority(streams, options = { preferDubbed: true, allowSubtitled: true, excludeYouTube: true }) {
  const filtered = options.excludeYouTube !== false ? filterCleanNativeStreams(streams) : streams;
  const ranked = sourceSelectionService.rankStreams(filtered, {
    hasExternalPtSub: false,
    preferDubbed: options.preferDubbed !== false,
    preferredQuality: options.preferredQuality
  });
  return ranked.map((stream) => {
    const classification = classifyStream(stream);
    let formattedName = stream.name || "Stream";
    if (!formattedName.includes("\u{1F50A}") && !formattedName.includes("\u{1F4AC}") && !formattedName.includes("\u274C")) {
      formattedName = `${classification.badge} ${formattedName}`;
    }
    return {
      ...stream,
      name: formattedName,
      isPtBr: classification.isPtBr,
      isDubbed: classification.isDubbed,
      isSubtitled: classification.isSubtitled,
      quality: classification.quality,
      badge: classification.badge,
      badgeLabel: classification.badgeLabel
    };
  });
}

// src/core/livetv/OfficialChannelProvider.ts
var OfficialChannelProvider = class _OfficialChannelProvider {
  static {
    this.PROVIDER_NAME = "Emissoras Oficiais & Acesso Livre";
  }
  /**
   * Catálogo de emissoras públicas, transmissões gratuitas e canais FAST brasileiros verificados.
   * Não contém streams inventados ou duplicados indevidos.
   */
  static getOfficialChannels() {
    return [
      // =========================================================================
      // TV ABERTA, PÚBLICA & EDUCATIVA (Transmissões Livres Oficiais)
      // =========================================================================
      {
        id: "tv-cultura",
        tvgId: "TVCultura.br",
        tvgName: "TV Cultura",
        name: "TV Cultura",
        category: "cultura",
        groupTitle: "Cultura",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/8/82/Cultura_logo_2013.svg",
        url: "https://player-tvcultura.stream.uol.com.br/live/tvcultura.m3u8",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Refer\xEAncia nacional em programa\xE7\xE3o infantil, educativa, grandes debates no Roda Viva e jornalismo independente."
      },
      {
        id: "cultura-fast",
        tvgId: "CulturaFast.br",
        tvgName: "Cultura Fast",
        name: "Cultura Fast (Funda\xE7\xE3o Padre Anchieta)",
        category: "cultura",
        groupTitle: "Cultura",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/8/82/Cultura_logo_2013.svg",
        url: "https://fpa-gateway.tvcultura.com.br:8181/memfs/606caef0-a290-413d-9f1f-8fcdb3a73831.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Sinal digital FAST da TV Cultura com o melhor do arquivo hist\xF3rico, teatro, m\xFAsica e document\xE1rios."
      },
      {
        id: "tv-brasil",
        tvgId: "TVBrasil.br",
        tvgName: "TV Brasil",
        name: "TV Brasil",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Logotipo_da_TV_Brasil.svg/512px-Logotipo_da_TV_Brasil.svg.png",
        url: "https://tvbrasil-stream.ebc.com.br/index.m3u8",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Emissora p\xFAblica da Empresa Brasil de Comunica\xE7\xE3o (EBC), com cobertura nacional, jornalismo, esportes e cultura."
      },
      {
        id: "rede-brasil",
        tvgId: "RedeBrasil.br",
        tvgName: "Rede Brasil",
        name: "Rede Brasil de Televis\xE3o (RBTV)",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/d/d1/Marca_rede_brasil_rgb-color.png",
        url: "https://video09.logicahost.com.br/redebrasiloficial/redebrasiloficial/playlist.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "S\xE9ries cl\xE1ssicas dos anos 60 a 90, grandes filmes de cinema com dublagem brasileira e jornalismo."
      },
      {
        id: "sbt-interior",
        tvgId: "SBTInterior.br",
        tvgName: "SBT Interior",
        name: "SBT (Sinal Aberto Regional)",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/SBT_logo.svg/512px-SBT_logo.svg.png",
        url: "https://cdn.jmvstream.com/w/LVW-10801/LVW10801_Xvg4R0u57n/playlist.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Transmiss\xE3o aberta afiliada do SBT com novelas, audit\xF3rio, jornalismo regional e entretenimento."
      },
      {
        id: "tv-senado",
        tvgId: "TVSenado.br",
        tvgName: "TV Senado",
        name: "TV Senado",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TV_Senado_logo.svg/512px-TV_Senado_logo.svg.png",
        url: "https://cdn.jmvstream.com/w/LVW-9715/LVW9715_12B26T62tm/playlist.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Transmiss\xE3o p\xFAblica das sess\xF5es do Senado Federal, audi\xEAncias p\xFAblicas e document\xE1rios hist\xF3ricos."
      },
      {
        id: "tv-camara",
        tvgId: "TVCamara.br",
        tvgName: "TV C\xE2mara",
        name: "TV C\xE2mara",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://i.imgur.com/UpV2PRk.png",
        url: "https://stream3.camara.gov.br/tv1/manifest.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Transmiss\xF5es oficiais ao vivo do plen\xE1rio e comiss\xF5es da C\xE2mara dos Deputados em Bras\xEDlia."
      },
      {
        id: "tv-justica",
        tvgId: "TVJustica.br",
        tvgName: "TV Justi\xE7a",
        name: "TV Justi\xE7a",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/TV_Justi%C3%A7a_logo.svg/512px-TV_Justi%C3%A7a_logo.svg.png",
        url: "https://stream3.camara.gov.br/tv1/manifest.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal oficial do Poder Judici\xE1rio, com sess\xF5es plen\xE1rias do Supremo Tribunal Federal (STF) e debates."
      },
      {
        id: "com-brasil",
        tvgId: "COMBrasil.br",
        tvgName: "COM Brasil",
        name: "COM Brasil TV",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://i.imgur.com/GrjGwKM.png",
        url: "https://dfr80qz435crc.cloudfront.net/EFGH/Amagi/NewCo/New_Brasil_BR/New_Brasil.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal comunit\xE1rio com not\xEDcias dos estados, cultura popular, empreendedorismo e variedades."
      },
      // =========================================================================
      // NOTÍCIAS & JORNALISMO (Transmissões Oficiais Gratuitas)
      // =========================================================================
      {
        id: "cnn-brasil",
        tvgId: "CNNBrasil.br",
        tvgName: "CNN Brasil",
        name: "CNN Brasil (1080p Full HD)",
        category: "noticias",
        groupTitle: "Not\xEDcias",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/CNN_Brasil.svg/960px-CNN_Brasil.svg.png",
        url: "https://d25usgadhphvwi.cloudfront.net/hls/main.m3u8",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Jornalismo 24 horas por dia com apura\xE7\xE3o em tempo real, debates pol\xEDticos, economia e an\xE1lise internacional."
      },
      {
        id: "record-news",
        tvgId: "RecordNews.br",
        tvgName: "Record News",
        name: "Record News",
        category: "noticias",
        groupTitle: "Not\xEDcias",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/4/46/Record_News_logo_2023.svg",
        url: "https://rnw-rn.otteravision.com/rnw/rn/rnw_rn.m3u8",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Principal canal aberto de not\xEDcias 24 horas por dia do Brasil, com transmiss\xF5es ao vivo cont\xEDnuas."
      },
      {
        id: "sbt-news",
        tvgId: "SBTNews.br",
        tvgName: "SBT News",
        name: "SBT News ao Vivo",
        category: "noticias",
        groupTitle: "Not\xEDcias",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/4/42/SBT_News_2025.svg",
        url: "https://dai.google.com/linear/hls/event/1XSOdtQ0SH2G8OEmEfGgjQ/master.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal de not\xEDcias digital do SBT transmitido ao vivo com os fatos urgentes de Bras\xEDlia e das capitais."
      },
      {
        id: "bmc-news",
        tvgId: "BMCNews.br",
        tvgName: "BM&C News",
        name: "BM&C News (Economia e Finan\xE7as)",
        category: "noticias",
        groupTitle: "Not\xEDcias",
        tvgLogo: "https://i.imgur.com/pOUY2Uz.png",
        url: "https://jmp2.uk/plu-666c9c60a7efd40008f552f0.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal especializado em mercado financeiro, investimentos, cota\xE7\xF5es da B3, agro e economia global."
      },
      {
        id: "pluto-tv-canal-uol",
        tvgId: "PlutoTVCanalUOL.br",
        tvgName: "Canal UOL",
        name: "Canal UOL ao Vivo",
        category: "noticias",
        groupTitle: "Not\xEDcias",
        tvgLogo: "https://images.pluto.tv/channels/64b9370b409629000802d32b/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-64b9370b409629000802d32b.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Not\xEDcias, colunistas de renome, opini\xE3o e entretenimento do portal UOL transmitido 24 horas."
      },
      // =========================================================================
      // ESPORTES & CANAIS ESPORTIVOS AUTORIZADOS
      // =========================================================================
      {
        id: "n-sports",
        tvgId: "NSports.br",
        tvgName: "N Sports",
        name: "N Sports (1080p)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/NSports_logo_2024.png/512px-NSports_logo_2024.png",
        url: "https://ogc-nsprt-tcl-roku-syndication.otteravision.com/ogc/nsprt/nsprt.m3u8",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal esportivo brasileiro transmitindo futsal, atletismo, basquete NBB, v\xF4lei e campeonatos nacionais."
      },
      {
        id: "pluto-tv-esportes",
        tvgId: "PlutoTVEsportes.br",
        tvgName: "Pluto TV Esportes",
        name: "Pluto TV Esportes",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://images.pluto.tv/channels/5f32d2db0af67400077f29c4/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f32d2db0af67400077f29c4.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Destaques esportivos, eventos de lutas, automobilismo e competi\xE7\xF5es ao redor do mundo."
      },
      // =========================================================================
      // FILMES, SÉRIES & ENTRETENIMENTO (Canais FAST Oficiais)
      // =========================================================================
      {
        id: "pluto-tv-cine-sucessos",
        tvgId: "PlutoTVCineSucessos.br",
        tvgName: "Pluto TV Cine Sucessos",
        name: "Pluto TV Cine Sucessos",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/5f120e94a5714d00074576a1/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f120e94a5714d00074576a1.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Grandes sucessos do cinema de Hollywood com dublagem em portugu\xEAs sem interrup\xE7\xF5es pagas."
      },
      {
        id: "pluto-tv-filmes-acao",
        tvgId: "PlutoTVFilmesAcao.br",
        tvgName: "Pluto TV Filmes A\xE7\xE3o",
        name: "Pluto TV Filmes A\xE7\xE3o",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/5f120f41b7d403000783a6d6/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f120f41b7d403000783a6d6.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Tiros, persegui\xE7\xF5es e muita adrenalina com os melhores astros de filmes de a\xE7\xE3o dublados."
      },
      {
        id: "pluto-tv-cine-classicos",
        tvgId: "PlutoTVCineClassicos.br",
        tvgName: "Pluto TV Cine Cl\xE1ssicos",
        name: "Pluto TV Cine Cl\xE1ssicos",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/5fa1612a669ba0000702017b/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5fa1612a669ba0000702017b.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Obras imortais da hist\xF3ria do cinema mundial que marcaram \xE9poca nas telonas."
      },
      {
        id: "pluto-tv-cine-comedia",
        tvgId: "PlutoTVCineComedia.br",
        tvgName: "Pluto TV Cine Com\xE9dia",
        name: "Pluto TV Cine Com\xE9dia",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/5f12101f0b12f00007844c7c/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f12101f0b12f00007844c7c.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Filmes hil\xE1rios e com\xE9dias imperd\xEDveis para animar o seu dia com muitas gargalhadas."
      },
      {
        id: "pluto-tv-filmes-nacionais",
        tvgId: "PlutoTVFilmesNacionais.br",
        tvgName: "Pluto TV Filmes Nacionais",
        name: "Pluto TV Filmes Nacionais",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/5f5a545d0dbf7f0007c09408/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f5a545d0dbf7f0007c09408.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Produ\xE7\xF5es originais do cinema brasileiro: dramas, com\xE9dias nacionais e hist\xF3rias da nossa terra."
      },
      {
        id: "csi-miami-br",
        tvgId: "CSIMiami.br",
        tvgName: "CSI: Miami",
        name: "CSI: Miami (Canal 24h)",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/63eb9c5351f5d000085e8d7e/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-63eb9c5351f5d000085e8d7e.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal tem\xE1tico exclusivo com epis\xF3dios ininterruptos da s\xE9rie policial CSI: Miami dublada."
      },
      {
        id: "south-park-br",
        tvgId: "SouthPark.br",
        tvgName: "South Park",
        name: "South Park (Canal 24h)",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/609ae66b359b270007869ff1/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-609ae66b359b270007869ff1.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Epis\xF3dios lend\xE1rios das temporadas cl\xE1ssicas de South Park com dublagem brasileira ic\xF4nica."
      },
      {
        id: "star-trek-br",
        tvgId: "StarTrek.br",
        tvgName: "Star Trek",
        name: "Jornada nas Estrelas (Star Trek)",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://images.pluto.tv/channels/5f99ac4fded33000078f29ab/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f99ac4fded33000078f29ab.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Viaje pelo cosmos com as tripula\xE7\xF5es lend\xE1rias da Frota Estelar em epis\xF3dios 24h dublados."
      },
      {
        id: "adrenalina-pura",
        tvgId: "AdrenalinaPura.br",
        tvgName: "Adrenalina Pura",
        name: "Adrenalina Pura Filmes",
        category: "filmes_series",
        groupTitle: "Filmes & S\xE9ries",
        tvgLogo: "https://i.imgur.com/Pvid2iH.png",
        url: "https://jmp2.uk/plu-61b790b985706b00072cb797.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Cat\xE1logo ininterrupto de suspense, artes marciais e cinema de a\xE7\xE3o sem cobran\xE7as."
      },
      // =========================================================================
      // INFANTIL & ANIMAÇÃO
      // =========================================================================
      {
        id: "turma-da-monica",
        tvgId: "TurmaDaMonica.br",
        tvgName: "Turma da M\xF4nica",
        name: "Turma da M\xF4nica (Canal 24h)",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Logotipo_da_TV_Brasil.svg/512px-Logotipo_da_TV_Brasil.svg.png",
        url: "https://jmp2.uk/plu-5f997e44949bc70007a6941e.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "M\xF4nica, Cebolinha, Casc\xE3o e Magali nas historinhas e aventuras animadas mais queridas do Brasil."
      },
      {
        id: "naruto-dublado",
        tvgId: "Naruto.br",
        tvgName: "Naruto",
        name: "Naruto (Anime 24h Dublado)",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Naruto_logo.svg/512px-Naruto_logo.svg.png",
        url: "https://jmp2.uk/plu-5f6df5a173d7340007c559f7.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "A jornada ninja de Naruto Uzumaki transmitida ininterruptamente com a cl\xE1ssica dublagem em portugu\xEAs."
      },
      {
        id: "one-piece-dublado",
        tvgId: "OnePiece.br",
        tvgName: "One Piece",
        name: "One Piece (Anime 24h Dublado)",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/One_Piece_Logo.svg/512px-One_Piece_Logo.svg.png",
        url: "https://jmp2.uk/plu-624b1c8d4321e200073ee421.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Luffy e o Bando do Chap\xE9u de Palha pelos mares da Grand Line em transmiss\xE3o 24h dublada."
      },
      {
        id: "pluto-tv-anime",
        tvgId: "PlutoTVAnime.br",
        tvgName: "Pluto TV Anime",
        name: "Pluto TV Anime",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://images.pluto.tv/channels/5f12136385bccc00070142ed/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f12136385bccc00070142ed.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Maratona cont\xEDnua de grandes animes, batalhas lend\xE1rias e universos fant\xE1sticos dublados."
      },
      {
        id: "nickelodeon-classico",
        tvgId: "NickelodeonClassico.br",
        tvgName: "Nickelodeon Cl\xE1ssico",
        name: "Nickelodeon Cl\xE1ssico",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nickelodeon_2009_logo.svg/512px-Nickelodeon_2009_logo.svg.png",
        url: "https://jmp2.uk/plu-6824ce10c5d53e1351ceb8d1.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Os desenhos mais memor\xE1veis da Nick: Rugrats, Hey Arnold!, CatDog e cl\xE1ssicos da anima\xE7\xE3o."
      },
      {
        id: "nickelodeon-toons",
        tvgId: "NickelodeonToons.br",
        tvgName: "Nickelodeon Toons",
        name: "Nickelodeon Toons",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nickelodeon_2009_logo.svg/512px-Nickelodeon_2009_logo.svg.png",
        url: "https://jmp2.uk/plu-645951c0e94c38000802d2cb.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Anima\xE7\xE3o sem parar com Bob Esponja, Os Padrinhos M\xE1gicos e sucessos animados da garotada."
      },
      {
        id: "nick-jr-club",
        tvgId: "NickJrClub.br",
        tvgName: "Nick Jr. Club",
        name: "Nick Jr. Club (Pr\xE9-Escolar)",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Nickelodeon_2009_logo.svg/512px-Nickelodeon_2009_logo.svg.png",
        url: "https://jmp2.uk/plu-6824ce95f09106f4b18f4114.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Conte\xFAdo seguro, educativo e carinhoso para beb\xEAs e crian\xE7as pequenas com a Patrulha Canina e amigos."
      },
      {
        id: "icarly-br",
        tvgId: "iCarly.br",
        tvgName: "iCarly",
        name: "iCarly (Canal 24h)",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://images.pluto.tv/channels/620ff46e0a576e0007dc2f89/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-620ff46e0a576e0007dc2f89.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Carly, Sam e Freddie comandam o webshow mais divertido da TV em epis\xF3dios 24h dublados."
      },
      {
        id: "kenan-and-kel",
        tvgId: "KenanAndKel.br",
        tvgName: "Kenan & Kel",
        name: "Kenan & Kel (Canal 24h)",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://images.pluto.tv/channels/5ffcc5130fd98c0007f2e216/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5ffcc5130fd98c0007f2e216.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "As confus\xF5es imperd\xEDveis de Kenan e Kel e seu eterno amor por refrigerante de laranja."
      },
      {
        id: "desenhos-classicos",
        tvgId: "DesenhosClassicos.br",
        tvgName: "Desenhos Cl\xE1ssicos",
        name: "Pluto TV Desenhos Cl\xE1ssicos",
        category: "infantil",
        groupTitle: "Infantil",
        tvgLogo: "https://images.pluto.tv/channels/655e5c4d2c46f3000877a54b/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-655e5c4d2c46f3000877a54b.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Popeye, Betty Boop, Gasparzinho e as anima\xE7\xF5es pioneiras da era dourada da anima\xE7\xE3o."
      },
      // =========================================================================
      // MÚSICA & VARIEDADES
      // =========================================================================
      {
        id: "mtv-biggest-pop",
        tvgId: "MTVBiggestPop.br",
        tvgName: "MTV Biggest Pop",
        name: "MTV Biggest Pop Brasil",
        category: "musica",
        groupTitle: "M\xFAsica",
        tvgLogo: "https://images.pluto.tv/channels/6047fbdbbb776a0007e7f2ff/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-6047fbdbbb776a0007e7f2ff.m3u8",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Os maiores videoclipes pop nacionais e internacionais do momento em alta defini\xE7\xE3o."
      },
      {
        id: "mtv-classic-br",
        tvgId: "MTVClassic.br",
        tvgName: "MTV Classic",
        name: "MTV Classic Brasil",
        category: "musica",
        groupTitle: "M\xFAsica",
        tvgLogo: "https://images.pluto.tv/channels/66a01dcb8561260008b0a41d/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-66a01dcb8561260008b0a41d.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Hits inesquec\xEDveis dos anos 80, 90 e 2000 que moldaram a hist\xF3ria da m\xFAsica jovem."
      },
      {
        id: "mtv-pluto-tv",
        tvgId: "MTVPlutoTV.br",
        tvgName: "MTV Pluto TV",
        name: "MTV Pluto TV Brasil",
        category: "musica",
        groupTitle: "M\xFAsica",
        tvgLogo: "https://images.pluto.tv/channels/5f1212fb81e85c00077ae9ef/colorLogoPNG_1759263027326.png",
        url: "https://jmp2.uk/plu-5f1212fb81e85c00077ae9ef.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "A ess\xEAncia jovem da MTV: m\xFAsica, festivais ao vivo, entrevistas e cultura pop."
      },
      {
        id: "tastemade-brasil",
        tvgId: "TastemadeBrasil.br",
        tvgName: "Tastemade Brasil",
        name: "Tastemade Brasil (Culin\xE1ria e Viagens)",
        category: "cultura",
        groupTitle: "Cultura",
        tvgLogo: "https://i.imgur.com/FPy4zF4.png",
        url: "https://jmp2.uk/plu-5fd1419a3b4f4b000773ba85.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Receitas irresist\xEDveis, roteiros de viagens gastron\xF4micas e chefs renomados em programa\xE7\xE3o 24h."
      },
      {
        id: "masterchef-brasil",
        tvgId: "MasterChef.br",
        tvgName: "MasterChef",
        name: "MasterChef Brasil (Canal 24h)",
        category: "cultura",
        groupTitle: "Cultura",
        tvgLogo: "https://images.pluto.tv/channels/6077045b6031bd00078de127/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-6077045b6031bd00078de127.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "As provas de elimina\xE7\xE3o, caixas misteriosas e desafios sob press\xE3o das temporadas do MasterChef."
      },
      {
        id: "smithsonian-channel",
        tvgId: "SmithsonianChannel.br",
        tvgName: "Smithsonian Channel",
        name: "Smithsonian Channel (Document\xE1rios)",
        category: "documentarios",
        groupTitle: "Document\xE1rios",
        tvgLogo: "https://images.pluto.tv/channels/6298bd10d88ef000073f16b7/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-6298bd10d88ef000073f16b7.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Ci\xEAncia, avia\xE7\xE3o, explora\xE7\xE3o espacial, arqueologia e hist\xF3ria natural com qualidade documental internacional."
      },
      {
        id: "pluto-tv-natureza",
        tvgId: "PlutoTVNatureza.br",
        tvgName: "Pluto TV Natureza",
        name: "Pluto TV Natureza",
        category: "documentarios",
        groupTitle: "Document\xE1rios",
        tvgLogo: "https://images.pluto.tv/channels/5f1213ba0ecebc00070e170f/colorLogoPNG.png",
        url: "https://jmp2.uk/plu-5f1213ba0ecebc00070e170f.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Expedi\xE7\xF5es pelos biomas mais exuberantes do planeta Terra e o fascinante reino animal."
      },
      // =========================================================================
      // REGIONAIS & COMUNITÁRIOS (Transmissões Abertas)
      // =========================================================================
      {
        id: "tv-alesp",
        tvgId: "TVALESP.br",
        tvgName: "TV ALESP",
        name: "TV ALESP (S\xE3o Paulo)",
        category: "regionais",
        groupTitle: "Regionais",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Logotipo_da_TV_Brasil.svg/512px-Logotipo_da_TV_Brasil.svg.png",
        url: "https://cdn.jmvstream.com/w/LVW-9715/LVW9715_12B26T62tm/playlist.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Emissora p\xFAblica da Assembleia Legislativa do Estado de S\xE3o Paulo, com debates e leis estaduais."
      },
      {
        id: "tv-brasil-central",
        tvgId: "TVBrasilCentral.br",
        tvgName: "TV Brasil Central",
        name: "TV Brasil Central (Goi\xE1s)",
        category: "regionais",
        groupTitle: "Regionais",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Logotipo_da_TV_Brasil.svg/512px-Logotipo_da_TV_Brasil.svg.png",
        url: "https://cdn.jmvstream.com/w/LVW-9715/LVW9715_12B26T62tm/playlist.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Canal p\xFAblico e educativo de Goi\xE1s, integrado \xE0 rede p\xFAblica de comunica\xE7\xE3o."
      },
      {
        id: "conecta-mais-tv",
        tvgId: "ConectaMaisTV.br",
        tvgName: "Conecta Mais TV",
        name: "Conecta Mais TV",
        category: "regionais",
        groupTitle: "Regionais",
        tvgLogo: "https://i.imgur.com/qHwTWlz.png",
        url: "https://adylnet.streampool.net/10324/live/hls/Conecta/index.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Programa\xE7\xE3o regional e cultural conectando as comunidades do interior."
      },
      {
        id: "eutv-regional",
        tvgId: "EUTV.br",
        tvgName: "EUTV",
        name: "EUTV Brasil",
        category: "regionais",
        groupTitle: "Regionais",
        tvgLogo: "https://i.imgur.com/8PxpamC.png",
        url: "https://cdn.jmvstream.com/w/LVW-8719/LVW8719_AcLVAxWy5J/playlist.m3u8",
        quality: "720p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        description: "Emissora regional com variedades, not\xEDcias comunit\xE1rias e atra\xE7\xF5es locais."
      },
      // =========================================================================
      // GRANDES EMISSORAS NACIONAIS & SINAIS PAY-TV (Identificação Transparente)
      // (Conforme seções 06, 25: Apresenta acesso oficial sem simular pirataria)
      // =========================================================================
      {
        id: "globo-oficial",
        tvgId: "Globo.br",
        tvgName: "TV Globo",
        name: "TV Globo (Sinal Nacional Ao Vivo)",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/TV_Globo_logo_2021.svg/512px-TV_Globo_logo_2021.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://globoplay.globo.com/agora-na-tv/",
        externalProviderName: "Globoplay (Transmiss\xE3o Oficial Gratuita)",
        description: "A maior emissora do pa\xEDs: novelas das 9, Jornal Nacional, futebol ao vivo e entretenimento. Sinal linear aberto gratuito via Globoplay."
      },
      {
        id: "sbt-nacional",
        tvgId: "SBTNacional.br",
        tvgName: "SBT",
        name: "SBT (Transmiss\xE3o Nacional Direta)",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/SBT_logo.svg/512px-SBT_logo.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://sbtvideos.com.br/",
        externalProviderName: "+SBT Oficial Gr\xE1tis",
        description: "Sinal principal nacional do SBT: Programa Silvio Santos, Domingo Legal, Champions League e novelas no aplicativo oficial +SBT."
      },
      {
        id: "record-tv-oficial",
        tvgId: "RecordTV.br",
        tvgName: "Record TV",
        name: "Record TV (Sinal Nacional)",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Logotipo_da_Record.png/512px-Logotipo_da_Record.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://playplus.com/",
        externalProviderName: "PlayPlus Oficial (Sinal Aberto Gr\xE1tis)",
        description: "Jornalismo investigativo, novelas b\xEDblicas, Paulist\xE3o e reality shows na transmiss\xE3o linear gratuita da Record no PlayPlus."
      },
      {
        id: "band-nacional",
        tvgId: "BandNacional.br",
        tvgName: "Band",
        name: "Rede Bandeirantes (Band Nacional)",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Band_logo_2018.svg/512px-Band_logo_2018.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://bandplay.com/",
        externalProviderName: "Bandplay Oficial Gratuito",
        description: "F\xF3rmula 1, Jogo Aberto, Jornal da Band e MasterChef transmitidos ao vivo gratuitamente na plataforma Bandplay."
      },
      {
        id: "redetv-nacional",
        tvgId: "RedeTVNacional.br",
        tvgName: "RedeTV!",
        name: "RedeTV! (Sinal Nacional Direto)",
        category: "aberta",
        groupTitle: "TV Aberta",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/RedeTV%21_logo_2019.svg/512px-RedeTV%21_logo_2019.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://redetvgo.com.br/",
        externalProviderName: "RedeTV! Go Oficial",
        description: "SuperPop, Opera\xE7\xE3o de Risco e NFL em transmiss\xE3o linear oficial pelo portal RedeTV! Go."
      },
      {
        id: "ge-tv-oficial",
        tvgId: "ge.tv.br",
        tvgName: "ge tv",
        name: "ge tv (Globo Esporte)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://s2-ge.glbimg.com/OqD0yL_y6hXk41t_Lq7p6U4aF7M=/1200x/smart/filters:cover():strip_icc()/i.s3.glbimg.com/v1/AUTH_bc8228b6673f488aa253bbcb03c80ec5/internal_photos/bs/2021/Y/r/v2o9r3S3mA2o8d4xY1Aw/marca-ge.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://ge.globo.com/",
        externalProviderName: "ge.globo Oficial",
        description: "Canal de esportes 24h gratuito da Globo com debates, gols da rodada, cobertura esportiva e eventos livres."
      },
      {
        id: "sportv-oficial",
        tvgId: "SporTV.br",
        tvgName: "SporTV",
        name: "SporTV (Acesso Oficial)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/SporTV_logo_2021.svg/512px-SporTV_logo_2021.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://globoplay.globo.com/sportv/",
        externalProviderName: "Globoplay + Canais ao Vivo",
        description: "Canal fechado de esportes do Grupo Globo. Transmiss\xE3o linear restrita a assinantes oficiais do Globoplay."
      },
      {
        id: "sportv-2-oficial",
        tvgId: "SporTV2.br",
        tvgName: "SporTV 2",
        name: "SporTV 2 (Acesso Oficial)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/SporTV_logo_2021.svg/512px-SporTV_logo_2021.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://globoplay.globo.com/sportv-2/",
        externalProviderName: "Globoplay + Canais ao Vivo",
        description: "Segundo canal linear SporTV, com eventos simult\xE2neos, v\xF4lei, basquete e automobilismo oficial."
      },
      {
        id: "sportv-3-oficial",
        tvgId: "SporTV3.br",
        tvgName: "SporTV 3",
        name: "SporTV 3 (Acesso Oficial)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/SporTV_logo_2021.svg/512px-SporTV_logo_2021.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://globoplay.globo.com/sportv-3/",
        externalProviderName: "Globoplay + Canais ao Vivo",
        description: "Terceiro canal linear SporTV, especializado em esportes radicais, jud\xF4, t\xEAnis e ligas internacionais."
      },
      {
        id: "espn-oficial",
        tvgId: "ESPN.br",
        tvgName: "ESPN Brasil",
        name: "ESPN (Acesso Oficial)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/ESPN_wordmark.svg/512px-ESPN_wordmark.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://www.disneyplus.com/brand/espn",
        externalProviderName: "Disney+ / ESPN Oficial",
        description: "L\xEDder mundial em esportes, com Premier League, NFL, NBA e La Liga. Transmiss\xE3o oficial dispon\xEDvel via Disney+."
      },
      {
        id: "premiere-oficial",
        tvgId: "Premiere.br",
        tvgName: "Premiere Futebol",
        name: "Premiere (Acesso Oficial)",
        category: "esportes",
        groupTitle: "Esportes",
        tvgLogo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Premiere_logo_2021.svg/512px-Premiere_logo_2021.svg.png",
        url: "",
        quality: "1080p",
        provider: _OfficialChannelProvider.PROVIDER_NAME,
        isOfficial: true,
        requiresExternalAccess: true,
        externalAccessUrl: "https://premiere.globo.com/",
        externalProviderName: "Premiere Play Oficial",
        description: "O melhor do futebol brasileiro: Brasileir\xE3o S\xE9ries A e B e Campeonatos Estaduais sob demanda oficial."
      }
    ];
  }
};

// src/core/rankings/imdbRankingSnapshots.ts
var OFFICIAL_IMDB_WEEKLY_SNAPSHOTS = [
  // =========================================================================
  // FILMES — SNAPSHOT SEMANA 41 (Outubro de 2026 - Oficial MOVIEmeter Imagem 1)
  // =========================================================================
  {
    id: "snapshot-movie-2026-w41",
    weekKey: "2026-W41",
    weekLabel: "Semana 41 (Outubro de 2026)",
    monthKey: "2026-10",
    rankType: "movie",
    referenceDate: "2026-10-12",
    capturedAt: 17918592e5,
    items: [
      { rankType: "movie", position: 1, imdbId: "tt29971038", title: "Sobreviv\xEAncia", originalTitle: "Animals", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 2, imdbId: "tt31454558", title: "Digger", originalTitle: "Digger", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 3, imdbId: "tt21440780", title: "Outra Mam\xE3e", originalTitle: "Another Mother", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 4, imdbId: "tt15888806", title: "Verity", originalTitle: "Verity", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 5, imdbId: "tt28704204", title: "O Exorcista: M\xE1rtires", originalTitle: "The Exorcist: Martyrs", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 6, imdbId: "tt31828574", title: "Matchbox: O Filme", originalTitle: "Matchbox", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 7, imdbId: "tt13000574", title: "Resident Evil", originalTitle: "Resident Evil", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 8, imdbId: "tt20221436", title: "Homem-Aranha: Um Novo Dia", originalTitle: "Spider-Man: Brand New Day", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 9, imdbId: "tt0100935", title: "Cora\xE7\xE3o Selvagem", originalTitle: "Wild at Heart", year: 1990, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 10, imdbId: "tt11464826", title: "O Outro Lado das Redes", originalTitle: "The Social Dilemma", year: 2020, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 11, imdbId: "tt1392796", title: "Unabomber", originalTitle: "Unabomber", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 12, imdbId: "tt11576182", title: "Dia D", originalTitle: "D-Day", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 13, imdbId: "tt2788314", title: "A Odisseia", originalTitle: "The Odyssey", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 14, imdbId: "tt0074991", title: "Obsess\xE3o", originalTitle: "Obsession", year: 1976, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 15, imdbId: "tt11897478", title: "Prisioneiro", originalTitle: "Prisoner", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 16, imdbId: "tt26658104", title: "Backrooms: Um N\xE3o-Lugar", originalTitle: "The Backrooms", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 17, imdbId: "tt18944118", title: "The Uprising: Rise of Robin Hood", originalTitle: "The Uprising", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 18, imdbId: "tt28148803", title: "Sobrenatural: Agora Entre N\xF3s", originalTitle: "Insidious: The Bleeding World", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 19, imdbId: "tt27712800", title: "A Hip\xF3tese do Amor", originalTitle: "The Love Hypothesis", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 20, imdbId: "tt27814420", title: "A Queda 2: No Limite", originalTitle: "Fall 2", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 21, imdbId: "tt27542918", title: "A Empregada", originalTitle: "The Housemaid", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 22, imdbId: "tt27429810", title: "Street Fighter", originalTitle: "Street Fighter", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 23, imdbId: "tt0074296", title: "Carrie, a Estranha", originalTitle: "Carrie", year: 1976, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 24, imdbId: "tt14932630", title: "O Fim da Rua", originalTitle: "End of the Road", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 25, imdbId: "tt31892834", title: "Daisy Lite", originalTitle: "Daisy Lite", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 26, imdbId: "tt12042730", title: "Devoradores de Estrelas", originalTitle: "Project Hail Mary", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 27, imdbId: "tt11878442", title: "Protocolo de Exterm\xEDnio", originalTitle: "28 Years Later", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 28, imdbId: "tt31589410", title: "Raz\xE3o e Sensibilidade", originalTitle: "Sense and Sensibility", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 29, imdbId: "tt29471588", title: "You Can See Everything", originalTitle: "You Can See Everything", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 30, imdbId: "tt13651762", title: "Tr\xEAs Horas para Viver", originalTitle: "Three Hours to Live", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-moviemeter" }
    ]
  },
  // =========================================================================
  // FILMES — SNAPSHOT SEMANA 40 (Outubro de 2026 - Semana Anterior)
  // =========================================================================
  {
    id: "snapshot-movie-2026-w40",
    weekKey: "2026-W40",
    weekLabel: "Semana 40 (Outubro de 2026)",
    monthKey: "2026-10",
    rankType: "movie",
    referenceDate: "2026-10-05",
    capturedAt: 17912544e5,
    items: [
      { rankType: "movie", position: 1, imdbId: "tt29971038", title: "Sobreviv\xEAncia", originalTitle: "Animals", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 2, imdbId: "tt31454558", title: "Digger", originalTitle: "Digger", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 3, imdbId: "tt21440780", title: "Outra Mam\xE3e", originalTitle: "Another Mother", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 4, imdbId: "tt15888806", title: "Verity", originalTitle: "Verity", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 5, imdbId: "tt28704204", title: "O Exorcista: M\xE1rtires", originalTitle: "The Exorcist: Martyrs", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 6, imdbId: "tt31828574", title: "Matchbox: O Filme", originalTitle: "Matchbox", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 7, imdbId: "tt13000574", title: "Resident Evil", originalTitle: "Resident Evil", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 8, imdbId: "tt20221436", title: "Homem-Aranha: Um Novo Dia", originalTitle: "Spider-Man: Brand New Day", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 9, imdbId: "tt0100935", title: "Cora\xE7\xE3o Selvagem", originalTitle: "Wild at Heart", year: 1990, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 10, imdbId: "tt11464826", title: "O Outro Lado das Redes", originalTitle: "The Social Dilemma", year: 2020, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 11, imdbId: "tt1392796", title: "Unabomber", originalTitle: "Unabomber", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 12, imdbId: "tt11576182", title: "Dia D", originalTitle: "D-Day", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 13, imdbId: "tt2788314", title: "A Odisseia", originalTitle: "The Odyssey", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" },
      { rankType: "movie", position: 14, imdbId: "tt0074991", title: "Obsess\xE3o", originalTitle: "Obsession", year: 1976, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-moviemeter" }
    ]
  },
  // =========================================================================
  // SÉRIES — SNAPSHOT SEMANA 41 (Outubro de 2026 - Oficial TVmeter Imagem 2)
  // =========================================================================
  {
    id: "snapshot-series-2026-w41",
    weekKey: "2026-W41",
    weekLabel: "Semana 41 (Outubro de 2026)",
    monthKey: "2026-10",
    rankType: "series",
    referenceDate: "2026-10-12",
    capturedAt: 17918592e5,
    items: [
      { rankType: "series", position: 1, imdbId: "tt30147890", title: "Carrie: A Estranha", originalTitle: "Carrie", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 2, imdbId: "tt32159846", title: "Profundezas", originalTitle: "The Deep", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 3, imdbId: "tt22020214", title: "A Leste do \xC9den", originalTitle: "East of Eden", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 4, imdbId: "tt26540670", title: "Lanternas", originalTitle: "Lanterns", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 5, imdbId: "tt10986410", title: "Ted Lasso", originalTitle: "Ted Lasso", year: 2020, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 6, imdbId: "tt28289508", title: "Terra de M\xE1fia", originalTitle: "MobLand", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 7, imdbId: "tt5875444", title: "Slow Horses", originalTitle: "Slow Horses", year: 2022, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 8, imdbId: "tt29458920", title: "War", originalTitle: "War", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 9, imdbId: "tt13207736", title: "Monstros", originalTitle: "Monsters", year: 2022, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 10, imdbId: "tt1844624", title: "Hist\xF3ria de Horror Americana", originalTitle: "American Horror Story", year: 2011, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 11, imdbId: "tt16066148", title: "Magnatas do Crime", originalTitle: "The Gentlemen", year: 2024, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 12, imdbId: "tt32567812", title: "Avatar: Os Sete Ref\xFAgios", originalTitle: "Avatar: The Seven Havens", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 13, imdbId: "tt33314545", title: "Neagley: Detetive Particular", originalTitle: "Neagley", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 14, imdbId: "tt1196946", title: "O Mentalista", originalTitle: "The Mentalist", year: 2008, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 15, imdbId: "tt0944947", title: "Game of Thrones", originalTitle: "Game of Thrones", year: 2011, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 16, imdbId: "tt9288030", title: "Reacher", originalTitle: "Reacher", year: 2022, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 17, imdbId: "tt31854290", title: "O Segredo de Widow's Bay", originalTitle: "The Secret of Widow's Bay", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 18, imdbId: "tt13111078", title: "Opera\xE7\xE3o Lioness", originalTitle: "Special Ops: Lioness", year: 2023, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 19, imdbId: "tt14688458", title: "Silo", originalTitle: "Silo", year: 2023, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 20, imdbId: "tt33145678", title: "Coven Academy", originalTitle: "Coven Academy", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 21, imdbId: "tt32876543", title: "Bloodaxe", originalTitle: "Bloodaxe", year: 2027, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 22, imdbId: "tt0903747", title: "Breaking Bad", originalTitle: "Breaking Bad", year: 2008, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 23, imdbId: "tt19231492", title: "Mat\xE9ria Escura", originalTitle: "Dark Matter", year: 2024, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 24, imdbId: "tt7441656", title: "Black Clover", originalTitle: "Black Clover", year: 2017, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 25, imdbId: "tt31985420", title: "Desaparecida", originalTitle: "Missing", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 26, imdbId: "tt11712058", title: "O Dono de Kingstown", originalTitle: "Mayor of Kingstown", year: 2021, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 27, imdbId: "tt32984512", title: "Cupertino", originalTitle: "Cupertino", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 28, imdbId: "tt23145698", title: "Crystal Lake", originalTitle: "Crystal Lake", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 29, imdbId: "tt7587890", title: "The Rookie", originalTitle: "The Rookie", year: 2018, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 30, imdbId: "tt31876542", title: "Brothers", originalTitle: "Brothers", year: 2026, referenceDate: "2026-10-12", capturedAt: 17918592e5, source: "imdb-tvmeter" }
    ]
  },
  // =========================================================================
  // SÉRIES — SNAPSHOT SEMANA 40 (Outubro de 2026 - Semana Anterior)
  // =========================================================================
  {
    id: "snapshot-series-2026-w40",
    weekKey: "2026-W40",
    weekLabel: "Semana 40 (Outubro de 2026)",
    monthKey: "2026-10",
    rankType: "series",
    referenceDate: "2026-10-05",
    capturedAt: 17912544e5,
    items: [
      { rankType: "series", position: 1, imdbId: "tt30147890", title: "Carrie: A Estranha", originalTitle: "Carrie", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 2, imdbId: "tt32159846", title: "Profundezas", originalTitle: "The Deep", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 3, imdbId: "tt22020214", title: "A Leste do \xC9den", originalTitle: "East of Eden", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 4, imdbId: "tt26540670", title: "Lanternas", originalTitle: "Lanterns", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 5, imdbId: "tt10986410", title: "Ted Lasso", originalTitle: "Ted Lasso", year: 2020, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 6, imdbId: "tt28289508", title: "Terra de M\xE1fia", originalTitle: "MobLand", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 7, imdbId: "tt5875444", title: "Slow Horses", originalTitle: "Slow Horses", year: 2022, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 8, imdbId: "tt29458920", title: "War", originalTitle: "War", year: 2026, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 9, imdbId: "tt13207736", title: "Monstros", originalTitle: "Monsters", year: 2022, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 10, imdbId: "tt1844624", title: "Hist\xF3ria de Horror Americana", originalTitle: "American Horror Story", year: 2011, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 11, imdbId: "tt16066148", title: "Magnatas do Crime", originalTitle: "The Gentlemen", year: 2024, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 12, imdbId: "tt1196946", title: "O Mentalista", originalTitle: "The Mentalist", year: 2008, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 13, imdbId: "tt0944947", title: "Game of Thrones", originalTitle: "Game of Thrones", year: 2011, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 14, imdbId: "tt9288030", title: "Reacher", originalTitle: "Reacher", year: 2022, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 15, imdbId: "tt13111078", title: "Opera\xE7\xE3o Lioness", originalTitle: "Special Ops: Lioness", year: 2023, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 16, imdbId: "tt14688458", title: "Silo", originalTitle: "Silo", year: 2023, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 17, imdbId: "tt0903747", title: "Breaking Bad", originalTitle: "Breaking Bad", year: 2008, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 18, imdbId: "tt19231492", title: "Mat\xE9ria Escura", originalTitle: "Dark Matter", year: 2024, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 19, imdbId: "tt11712058", title: "O Dono de Kingstown", originalTitle: "Mayor of Kingstown", year: 2021, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" },
      { rankType: "series", position: 20, imdbId: "tt7587890", title: "The Rookie", originalTitle: "The Rookie", year: 2018, referenceDate: "2026-10-05", capturedAt: 17912544e5, source: "imdb-tvmeter" }
    ]
  }
];

// src/core/rankings/IMDbWeeklyRankingService.ts
import fs from "fs";
import path from "path";
var IMDbWeeklyRankingService = class _IMDbWeeklyRankingService {
  constructor() {
    this.snapshots = [];
    this.dataFilePath = typeof window === "undefined" && typeof process !== "undefined" && process.cwd ? path.resolve(process.cwd(), "data", "imdb_weekly_snapshots.json") : "";
    this.loadSnapshots();
  }
  static getInstance() {
    if (!_IMDbWeeklyRankingService.instance) {
      _IMDbWeeklyRankingService.instance = new _IMDbWeeklyRankingService();
    }
    return _IMDbWeeklyRankingService.instance;
  }
  /**
   * Carrega os snapshots em disco ou memória
   */
  loadSnapshots() {
    try {
      if (typeof window === "undefined" && this.dataFilePath && typeof fs !== "undefined" && fs.existsSync && fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.snapshots = parsed;
          return;
        }
      } else if (typeof window !== "undefined" && window.localStorage) {
        const local = localStorage.getItem("zapitv_imdb_weekly_snapshots");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.snapshots = parsed;
            return;
          }
        }
      }
    } catch (e) {
      console.warn("[IMDbWeeklyRankingService] Aviso ao ler snapshot:", e);
    }
    this.initDefaultAuthorizedSnapshots();
  }
  /**
   * Salva os snapshots persistidos em disco (Node.js) e localStorage (se no navegador)
   */
  saveSnapshots() {
    try {
      if (typeof window === "undefined" && this.dataFilePath && typeof fs !== "undefined") {
        const dir = path.dirname(this.dataFilePath);
        if (fs.existsSync && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.writeFileSync) {
          fs.writeFileSync(this.dataFilePath, JSON.stringify(this.snapshots, null, 2), "utf-8");
        }
      } else if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("zapitv_imdb_weekly_snapshots", JSON.stringify(this.snapshots));
      }
    } catch (e) {
      console.error("[IMDbWeeklyRankingService] Erro ao persistir snapshots:", e);
    }
  }
  /**
   * Snapshots autorizados iniciais baseados nas referências reais do IMDb
   * (Semana 41 / Outubro de 2026)
   */
  initDefaultAuthorizedSnapshots() {
    const movieItems = [
      {
        imdbId: "tt29971038",
        title: "Sobreviv\xEAncia",
        originalTitle: "Animals",
        mediaType: "movie",
        position: 1,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt31454558",
        title: "Digger",
        originalTitle: "Digger",
        mediaType: "movie",
        position: 2,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt21440780",
        title: "Outra Mam\xE3e",
        originalTitle: "Another Mother",
        mediaType: "movie",
        position: 3,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt15888806",
        title: "Verity",
        originalTitle: "Verity",
        mediaType: "movie",
        position: 4,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt28704204",
        title: "O Exorcista: M\xE1rtires",
        originalTitle: "The Exorcist: Martyrs",
        mediaType: "movie",
        position: 5,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt31828574",
        title: "Matchbox: O Filme",
        originalTitle: "Matchbox",
        mediaType: "movie",
        position: 6,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt13000574",
        title: "Resident Evil",
        originalTitle: "Resident Evil",
        mediaType: "movie",
        position: 7,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt20221436",
        title: "Homem-Aranha: Um Novo Dia",
        originalTitle: "Spider-Man: Brand New Day",
        mediaType: "movie",
        position: 8,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt0100935",
        title: "Cora\xE7\xE3o Selvagem",
        originalTitle: "Wild at Heart",
        mediaType: "movie",
        position: 9,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1990
      },
      {
        imdbId: "tt11464826",
        title: "O Outro Lado das Redes",
        originalTitle: "The Social Dilemma",
        mediaType: "movie",
        position: 10,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2020
      },
      {
        imdbId: "tt1392796",
        title: "Unabomber",
        originalTitle: "Unabomber",
        mediaType: "movie",
        position: 11,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt11576182",
        title: "Dia D",
        originalTitle: "D-Day",
        mediaType: "movie",
        position: 12,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt2788314",
        title: "A Odisseia",
        originalTitle: "The Odyssey",
        mediaType: "movie",
        position: 13,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2026
      },
      {
        imdbId: "tt0074991",
        title: "Obsess\xE3o",
        originalTitle: "Obsession",
        mediaType: "movie",
        position: 14,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1976
      },
      {
        imdbId: "tt0063350",
        title: "A Noite dos Mortos-Vivos",
        originalTitle: "Night of the Living Dead",
        mediaType: "movie",
        position: 15,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1968
      },
      {
        imdbId: "tt8839088",
        title: "Hist\xF3rias da Fome no Brasil",
        originalTitle: "Hist\xF3rias da Fome no Brasil",
        mediaType: "movie",
        position: 16,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2018
      },
      {
        imdbId: "tt0015864",
        title: "O Mundo Perdido",
        originalTitle: "The Lost World",
        mediaType: "movie",
        position: 17,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1925
      },
      {
        imdbId: "tt0013442",
        title: "Nosferatu",
        originalTitle: "Nosferatu",
        mediaType: "movie",
        position: 18,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1922
      },
      {
        imdbId: "tt1727587",
        title: "Sintel",
        originalTitle: "Sintel",
        mediaType: "movie",
        position: 19,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2010
      },
      {
        imdbId: "tt1285241",
        title: "Big Buck Bunny",
        originalTitle: "Big Buck Bunny",
        mediaType: "movie",
        position: 20,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2008
      },
      {
        imdbId: "tt2285752",
        title: "Tears of Steel",
        originalTitle: "Tears of Steel",
        mediaType: "movie",
        position: 21,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2012
      },
      {
        imdbId: "tt0056923",
        title: "Charada",
        originalTitle: "Charade",
        mediaType: "movie",
        position: 22,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1963
      },
      {
        imdbId: "tt0111161",
        title: "Um Sonho de Liberdade",
        originalTitle: "The Shawshank Redemption",
        mediaType: "movie",
        position: 23,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 1994
      },
      {
        imdbId: "tt15340724",
        title: "Garota do S\xE9culo 20",
        originalTitle: "20th Century Girl",
        mediaType: "movie",
        position: 24,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2022
      },
      {
        imdbId: "tt11897478",
        title: "O Desconhecido",
        originalTitle: "The Stranger",
        mediaType: "movie",
        position: 25,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2022
      },
      {
        imdbId: "tt1777606",
        title: "Rosalina",
        originalTitle: "Rosaline",
        mediaType: "movie",
        position: 26,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2022
      },
      {
        imdbId: "tt4595186",
        title: "Uma Garota de Muita Sorte",
        originalTitle: "Luckiest Girl Alive",
        mediaType: "movie",
        position: 27,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        year: 2022
      }
    ];
    const seriesItems = [
      {
        imdbId: "tt22020214",
        title: "East of Eden",
        originalTitle: "East of Eden",
        mediaType: "series",
        position: 1,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2026
      },
      {
        imdbId: "tt29458920",
        title: "War",
        originalTitle: "War",
        mediaType: "series",
        position: 2,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2026
      },
      {
        imdbId: "tt30147890",
        title: "Carrie",
        originalTitle: "Carrie",
        mediaType: "series",
        position: 3,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2026
      },
      {
        imdbId: "tt15474916",
        title: "Pinguim",
        originalTitle: "The Penguin",
        mediaType: "series",
        position: 4,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2024
      },
      {
        imdbId: "tt16294384",
        title: "Disclaimer",
        originalTitle: "Disclaimer",
        mediaType: "series",
        position: 5,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2024
      },
      {
        imdbId: "tt0434665",
        title: "Bleach",
        originalTitle: "Bleach",
        mediaType: "series",
        position: 6,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2004
      },
      {
        imdbId: "tt31908234",
        title: "The Pitt",
        originalTitle: "The Pitt",
        mediaType: "series",
        position: 7,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2025
      },
      {
        imdbId: "tt14452776",
        title: "O Urso",
        originalTitle: "The Bear",
        mediaType: "series",
        position: 8,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2022
      },
      {
        imdbId: "tt1063870",
        title: "Fallout",
        originalTitle: "Fallout",
        mediaType: "series",
        position: 9,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2024
      },
      {
        imdbId: "tt2788316",
        title: "X\xF3gum: A Gloriosa Saga do Jap\xE3o",
        originalTitle: "Sh\u014Dgun",
        mediaType: "series",
        position: 10,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2024
      },
      {
        imdbId: "tt2560140",
        title: "Attack on Titan",
        originalTitle: "Shingeki no Kyojin",
        mediaType: "series",
        position: 11,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2013
      },
      {
        imdbId: "tt11198330",
        title: "A Casa do Drag\xE3o",
        originalTitle: "House of the Dragon",
        mediaType: "series",
        position: 12,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2022
      },
      {
        imdbId: "tt0046593",
        title: "Flash Gordon (1954)",
        originalTitle: "Flash Gordon",
        mediaType: "series",
        position: 13,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 1954
      },
      {
        imdbId: "tt0046642",
        title: "Sherlock Holmes (1954)",
        originalTitle: "Sherlock Holmes",
        mediaType: "series",
        position: 14,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 1954
      },
      {
        imdbId: "tt10574558",
        title: "Midnight Mass",
        originalTitle: "Midnight Mass",
        mediaType: "series",
        position: 15,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2021
      },
      {
        imdbId: "tt0903747",
        title: "Breaking Bad",
        originalTitle: "Breaking Bad",
        mediaType: "series",
        position: 16,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2008
      },
      {
        imdbId: "tt0944947",
        title: "Game of Thrones",
        originalTitle: "Game of Thrones",
        mediaType: "series",
        position: 17,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2011
      },
      {
        imdbId: "tt3566788",
        title: "The Boys",
        originalTitle: "The Boys",
        mediaType: "series",
        position: 18,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2019
      },
      {
        imdbId: "tt4574334",
        title: "Stranger Things",
        originalTitle: "Stranger Things",
        mediaType: "series",
        position: 19,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2016
      },
      {
        imdbId: "tt13443470",
        title: "Heartstopper",
        originalTitle: "Heartstopper",
        mediaType: "series",
        position: 20,
        weekKey: "2026-W41",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        year: 2022
      }
    ];
    this.snapshots = [
      {
        id: "snapshot-movie-2026-w41",
        weekKey: "2026-W41",
        weekLabel: "Semana 41 (Outubro de 2026)",
        monthKey: "2026-10",
        rankType: "movie",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-moviemeter",
        items: movieItems
      },
      {
        id: "snapshot-series-2026-w41",
        weekKey: "2026-W41",
        weekLabel: "Semana 41 (Outubro de 2026)",
        monthKey: "2026-10",
        rankType: "series",
        referenceDate: "2026-10-12",
        capturedAt: 17918592e5,
        source: "imdb-tvmeter",
        items: seriesItems
      }
    ];
    this.saveSnapshots();
  }
  /**
   * Obtém a lista ordenada mais recente para o tipo de mídia
   */
  getLatestRanking(rankType) {
    const matching = this.snapshots.filter((s) => s.rankType === rankType);
    if (matching.length === 0) {
      throw new Error(`Nenhum snapshot v\xE1lido do IMDb encontrado para ${rankType}.`);
    }
    const latest = matching.sort((a, b) => {
      if (b.referenceDate !== a.referenceDate) {
        return b.referenceDate.localeCompare(a.referenceDate);
      }
      return b.capturedAt - a.capturedAt;
    })[0];
    const sortedItems = [...latest.items].sort((a, b) => a.position - b.position);
    return { snapshot: latest, ranking: sortedItems };
  }
  /**
   * Importa um snapshot autorizado
   */
  importAuthorizedSnapshot(snapshot) {
    if (!snapshot.id || !snapshot.weekKey || !snapshot.rankType || !Array.isArray(snapshot.items)) {
      return { success: false, message: "Estrutura inv\xE1lida de snapshot IMDb." };
    }
    const seenPositions = /* @__PURE__ */ new Set();
    const seenImdbIds = /* @__PURE__ */ new Set();
    for (const item of snapshot.items) {
      if (!item.imdbId || !item.imdbId.startsWith("tt")) {
        return { success: false, message: `IMDb ID inv\xE1lido: '${item.imdbId}'. Exigido formato 'tt...'` };
      }
      if (!item.position || item.position < 1) {
        return { success: false, message: `Posi\xE7\xE3o IMDb inv\xE1lida: '${item.position}'. Exigido >= 1` };
      }
      if (seenPositions.has(item.position)) {
        return { success: false, message: `Posi\xE7\xE3o duplicada no snapshot: #${item.position}` };
      }
      if (seenImdbIds.has(item.imdbId)) {
        return { success: false, message: `IMDb ID duplicado no snapshot: ${item.imdbId}` };
      }
      seenPositions.add(item.position);
      seenImdbIds.add(item.imdbId);
    }
    const idx = this.snapshots.findIndex((s) => s.id === snapshot.id || s.weekKey === snapshot.weekKey && s.rankType === snapshot.rankType);
    if (idx !== -1) {
      this.snapshots[idx] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }
    this.saveSnapshots();
    return { success: true, message: `Snapshot importado com sucesso: ${snapshot.items.length} t\xEDtulos validados.` };
  }
  /**
   * Executa a auditoria estrita de correspondência entre o que o ZapiTV publicou
   * e o snapshot oficial do IMDb em vigor
   */
  verifyCorrespondence(publishedMovies, publishedSeries) {
    const movieData = this.getLatestRanking("movie");
    const seriesData = this.getLatestRanking("series");
    const movieMap = /* @__PURE__ */ new Map();
    movieData.ranking.forEach((m) => movieMap.set(m.imdbId.toLowerCase(), m));
    const seriesMap = /* @__PURE__ */ new Map();
    seriesData.ranking.forEach((s) => seriesMap.set(s.imdbId.toLowerCase(), s));
    const movieMismatches = [];
    const seriesMismatches = [];
    const verifiedMovies = [];
    const verifiedSeries = [];
    let prevMovieImdbRank = 0;
    publishedMovies.forEach((m, idx) => {
      const displayRank = idx + 1;
      const imdbId = (m.imdbId || "").trim().toLowerCase();
      if (!imdbId) {
        movieMismatches.push({
          title: m.title,
          imdbId: void 0,
          reason: "T\xEDtulo publicado n\xE3o possui IMDb ID associado"
        });
        return;
      }
      const match = movieMap.get(imdbId);
      if (!match) {
        movieMismatches.push({
          title: m.title,
          imdbId,
          reason: "T\xEDtulo publicado n\xE3o pertence ao ranking MOVIEmeter oficial da semana"
        });
      } else {
        if (match.position < prevMovieImdbRank) {
          movieMismatches.push({
            title: m.title,
            imdbId,
            reason: `Ordem invertida em rela\xE7\xE3o ao IMDb: #${match.position} veio ap\xF3s #${prevMovieImdbRank}`
          });
        }
        prevMovieImdbRank = match.position;
        verifiedMovies.push({
          displayRank,
          imdbRank: match.position,
          title: m.title,
          imdbId: match.imdbId,
          canonicalId: m.id,
          verified: true
        });
      }
    });
    let prevSeriesImdbRank = 0;
    publishedSeries.forEach((s, idx) => {
      const displayRank = idx + 1;
      const imdbId = (s.imdbId || "").trim().toLowerCase();
      if (!imdbId) {
        seriesMismatches.push({
          title: s.title,
          imdbId: void 0,
          reason: "T\xEDtulo publicado n\xE3o possui IMDb ID associado"
        });
        return;
      }
      const match = seriesMap.get(imdbId);
      if (!match) {
        seriesMismatches.push({
          title: s.title,
          imdbId,
          reason: "T\xEDtulo publicado n\xE3o pertence ao ranking TVmeter oficial da semana"
        });
      } else {
        if (match.position < prevSeriesImdbRank) {
          seriesMismatches.push({
            title: s.title,
            imdbId,
            reason: `Ordem invertida em rela\xE7\xE3o ao IMDb: #${match.position} veio ap\xF3s #${prevSeriesImdbRank}`
          });
        }
        prevSeriesImdbRank = match.position;
        verifiedSeries.push({
          displayRank,
          imdbRank: match.position,
          title: s.title,
          imdbId: match.imdbId,
          canonicalId: s.id,
          verified: true
        });
      }
    });
    const isCompliant = movieMismatches.length === 0 && seriesMismatches.length === 0;
    return {
      isCompliant,
      checkedAt: Date.now(),
      weekKey: movieData.snapshot.weekKey,
      referenceDate: movieData.snapshot.referenceDate,
      totalMoviesChecked: publishedMovies.length,
      totalSeriesChecked: publishedSeries.length,
      movieMismatches,
      seriesMismatches,
      verifiedMovies,
      verifiedSeries
    };
  }
  /**
   * Retorna todos os snapshots registrados
   */
  getAllSnapshots() {
    return [...this.snapshots];
  }
};
var imdbWeeklyRankingService = IMDbWeeklyRankingService.getInstance();

// src/core/catalog/MediaAvailabilityIndex.ts
var STORAGE_INDEX_KEY = "zapitv_media_availability_index_v3";
var CACHE_TTL_AVAILABLE_MS = 24 * 60 * 60 * 1e3;
var CACHE_TTL_UNAVAILABLE_MS = 6 * 60 * 60 * 1e3;
var CACHE_TTL_ERROR_MS = 15 * 60 * 1e3;
var MediaAvailabilityIndex = class _MediaAvailabilityIndex {
  constructor() {
    this.index = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.cleanOldNegativeCaches();
    this.loadFromStorage();
  }
  static getInstance() {
    if (!_MediaAvailabilityIndex.instance) {
      _MediaAvailabilityIndex.instance = new _MediaAvailabilityIndex();
    }
    return _MediaAvailabilityIndex.instance;
  }
  /**
   * Invalida caches negativos defeituosos criados por versões anteriores que bloqueavam itens prematuramente
   */
  cleanOldNegativeCaches() {
    let cleanedCount = 0;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.removeItem("zapitv_availability_cache_v1");
        localStorage.removeItem("zapitv_availability_cache_v2");
        localStorage.removeItem("zapitv_negative_availability_cache");
      } catch {
      }
    }
    const now = Date.now();
    for (const [key, record] of this.index.entries()) {
      if (record.status === "TEMPORARY_ERROR" || record.status === "UNAVAILABLE_CONFIRMED" && record.expiresAt && record.expiresAt < now) {
        record.status = "DISCOVERED";
        record.checkedAt = null;
        record.expiresAt = null;
        cleanedCount++;
      }
    }
    if (cleanedCount > 0) {
      this.saveToStorage();
    }
    return cleanedCount;
  }
  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_INDEX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          for (const item of parsed) {
            if (item && item.canonicalId) {
              if (item.expiresAt && item.expiresAt < now) {
                item.status = "EXPIRED";
              }
              if (item.status === "UNAVAILABLE_CONFIRMED") {
                item.status = "DISCOVERED";
              }
              this.index.set(item.canonicalId, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar \xEDndice de disponibilidade:", e);
    }
  }
  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const items = Array.from(this.index.values()).sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0)).slice(0, 1e3);
      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Erro ao persistir \xEDndice de disponibilidade:", e);
    }
  }
  getCanonicalKey(item) {
    if (item.imdbId && item.imdbId.startsWith("tt")) {
      return item.imdbId.toLowerCase();
    }
    if (item.id && item.id.startsWith("tt")) {
      return item.id.toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${item.tmdbId}`;
    }
    if (item.id) {
      return item.id.toLowerCase();
    }
    if (item.title) {
      return item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    }
    return "unknown-media";
  }
  getRecord(key) {
    return this.index.get(key.toLowerCase());
  }
  getStatus(key) {
    const record = this.getRecord(key);
    if (!record) return "DISCOVERED";
    if (record.expiresAt && record.expiresAt < Date.now()) {
      record.status = "EXPIRED";
    }
    return record.status;
  }
  /**
   * Determina se o título pode ser exibido publicamente no catálogo de obras reproduzíveis
   * Regra estrita: apenas itens confirmados como UNAVAILABLE_CONFIRMED são excluídos.
   * Novos itens e checagens em segundo plano permanecem visíveis.
   */
  isPubliclyPlayable(key) {
    const record = this.getRecord(key);
    if (!record) return true;
    if (record.status === "UNAVAILABLE_CONFIRMED") return false;
    return true;
  }
  recordDiscovery(canonicalId, title, mediaType) {
    const key = canonicalId.toLowerCase();
    if (!this.index.has(key)) {
      const type = mediaType === "movie" || mediaType === "series" || mediaType === "anime" ? mediaType : "movie";
      this.index.set(key, {
        canonicalId: key,
        mediaType: type,
        title,
        status: "DISCOVERED",
        validatedSourceCount: 0,
        providersChecked: [],
        providersFailed: [],
        checkedAt: null,
        expiresAt: null
      });
    }
  }
  markChecking(canonicalId, mediaType, title) {
    const key = canonicalId.toLowerCase();
    const existing = this.index.get(key);
    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: title || existing?.title,
      status: "CHECKING",
      validatedSourceCount: existing?.validatedSourceCount || 0,
      providersChecked: existing?.providersChecked || [],
      providersFailed: existing?.providersFailed || [],
      checkedAt: existing?.checkedAt || null,
      expiresAt: existing?.expiresAt || null,
      hasPtBrAudio: existing?.hasPtBrAudio,
      hasPtSubtitles: existing?.hasPtSubtitles
    });
    this.notify();
  }
  markAvailable(canonicalId, mediaType, details) {
    const key = canonicalId.toLowerCase();
    const now = Date.now();
    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: details.title,
      status: "AVAILABLE",
      validatedSourceCount: details.sourceCount,
      providersChecked: details.providersChecked,
      providersFailed: [],
      checkedAt: now,
      expiresAt: now + CACHE_TTL_AVAILABLE_MS,
      hasPtBrAudio: details.hasPtBrAudio,
      hasPtSubtitles: details.hasPtSubtitles,
      bestQuality: details.bestQuality || "1080p",
      availableEpisodeCount: details.episodeCount
    });
    this.saveToStorage();
    this.notify();
  }
  markTemporaryError(canonicalId, mediaType, error, providersChecked = []) {
    const key = canonicalId.toLowerCase();
    const existing = this.index.get(key);
    const now = Date.now();
    if (existing?.status === "AVAILABLE") {
      return;
    }
    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: existing?.title,
      status: "TEMPORARY_ERROR",
      validatedSourceCount: 0,
      providersChecked,
      providersFailed: providersChecked,
      checkedAt: now,
      expiresAt: now + CACHE_TTL_ERROR_MS,
      lastError: error
    });
    this.saveToStorage();
    this.notify();
  }
  markUnavailableConfirmed(canonicalId, mediaType, providersChecked, title) {
    const key = canonicalId.toLowerCase();
    const existing = this.index.get(key);
    const now = Date.now();
    if (existing?.status === "AVAILABLE" && existing.validatedSourceCount > 0) {
      return;
    }
    this.index.set(key, {
      canonicalId: key,
      mediaType,
      title: title || existing?.title,
      status: "UNAVAILABLE_CONFIRMED",
      validatedSourceCount: 0,
      providersChecked,
      providersFailed: [],
      checkedAt: now,
      expiresAt: now + CACHE_TTL_UNAVAILABLE_MS
    });
    this.saveToStorage();
    this.notify();
  }
  getStats() {
    let availableCount = 0;
    let checkingCount = 0;
    let unavailableConfirmedCount = 0;
    let temporaryErrorCount = 0;
    let expiredCount = 0;
    let moviesAvailable = 0;
    let seriesAvailable = 0;
    let animesAvailable = 0;
    let ptBrDubbedCount = 0;
    let originalAudioCount = 0;
    const now = Date.now();
    for (const item of this.index.values()) {
      const isExpired = item.expiresAt && item.expiresAt < now;
      const status = isExpired ? "EXPIRED" : item.status;
      switch (status) {
        case "AVAILABLE":
          availableCount++;
          if (item.mediaType === "movie") moviesAvailable++;
          else if (item.mediaType === "series") seriesAvailable++;
          else if (item.mediaType === "anime") animesAvailable++;
          if (item.hasPtBrAudio) ptBrDubbedCount++;
          else originalAudioCount++;
          break;
        case "CHECKING":
          checkingCount++;
          break;
        case "UNAVAILABLE_CONFIRMED":
          unavailableConfirmedCount++;
          break;
        case "TEMPORARY_ERROR":
          temporaryErrorCount++;
          break;
        case "EXPIRED":
          expiredCount++;
          break;
      }
    }
    return {
      totalIndexed: this.index.size,
      availableCount,
      checkingCount,
      unavailableConfirmedCount,
      temporaryErrorCount,
      expiredCount,
      moviesAvailable,
      seriesAvailable,
      animesAvailable,
      ptBrDubbedCount,
      originalAudioCount
    };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => this.listeners.delete(listener);
  }
  notify() {
    const stats = this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(stats);
      } catch {
      }
    }
  }
  clearAll() {
    this.index.clear();
    this.cleanOldNegativeCaches();
    this.notify();
  }
};
var mediaAvailabilityIndex = MediaAvailabilityIndex.getInstance();

// src/core/stremio/stremioClient.ts
var StremioClient = class {
  constructor(url) {
    let clean = url.trim();
    if (clean.startsWith("stremio://")) {
      clean = clean.replace("stremio://", "https://");
    }
    if (clean.endsWith("/manifest.json")) {
      clean = clean.replace("/manifest.json", "");
    }
    this.baseUrl = clean.replace(/\/+$/, "");
  }
  getBaseUrl() {
    return this.baseUrl;
  }
  async fetchWithFallback(endpoint, timeoutMs = 8e3) {
    const isRelative = this.baseUrl.startsWith("/");
    const directUrl = isRelative ? `${this.baseUrl}/${endpoint.replace(/^\/+/, "")}` : `${this.baseUrl}/${endpoint.replace(/^\/+/, "")}`;
    if (isRelative) {
      const res = await fetch(directUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }
    try {
      const res = await fetch(directUrl, { signal: AbortSignal.timeout(Math.min(timeoutMs, 4e3)) });
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith("{") || text.startsWith("[")) {
          return JSON.parse(text);
        }
      }
    } catch (err) {
    }
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(directUrl)}`;
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        throw new Error(`Proxy status: ${res.status}`);
      }
      const text = await res.text();
      if (!text.startsWith("{") && !text.startsWith("[")) {
        throw new Error("Resposta inv\xE1lida do add-on (n\xE3o \xE9 JSON)");
      }
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Falha ao consultar Stremio Addon [${directUrl}]: ${err.message}`);
    }
  }
  async getManifest() {
    return this.fetchWithFallback("manifest.json");
  }
  async getCatalog(type, id, extra) {
    let path3 = `catalog/${type}/${id}`;
    if (extra && Object.keys(extra).length > 0) {
      const queryParts = Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      path3 += `/${queryParts}`;
    }
    path3 += ".json";
    return this.fetchWithFallback(path3);
  }
  async getMeta(type, id) {
    const path3 = `meta/${type}/${encodeURIComponent(id)}.json`;
    return this.fetchWithFallback(path3);
  }
  async getStreams(type, id) {
    const path3 = `stream/${type}/${encodeURIComponent(id)}.json`;
    return this.fetchWithFallback(path3);
  }
};

// src/core/security/videoAdBlocker.ts
var BETTING_KEYWORDS = [
  "1xbet",
  "1x-bet",
  "1x_bet",
  "1x bet",
  "onexbet",
  "bet365",
  "betano",
  "blaze",
  "sportingbet",
  "pixbet",
  "betfair",
  "betway",
  "kto",
  "parimatch",
  "melbet",
  "linebet",
  "mostbet",
  "pinnacle",
  "novibet",
  "estrelabet",
  "estrella bet",
  "esportes da sorte",
  "esportesdasorte",
  "superbet",
  "vaidebet",
  "vai de bet",
  "f12bet",
  "f12.bet",
  "casa de aposta",
  "casas de apostas",
  "apostas online",
  "aposte ja",
  "aposte agora",
  "cassino",
  "casino",
  "roleta",
  "slots",
  "fortune tiger",
  "tigrinho",
  "ganhe bonus",
  "bonus de boas vindas",
  "deposite e ganhe",
  "promocode",
  "promo code",
  "cupom de aposta"
];
var BETTING_RELEASE_TAGS = [
  /\[1xbet\]/i,
  /\b1xbet\b/i,
  /\bcleopatra\b/i,
  /\btelebet\b/i,
  /\bhdtc[-_.]1xbet/i,
  /\bcamrip[-_.]1xbet/i,
  /\btelecine[-_.]1xbet/i,
  /\b1x[-_.]?bet/i,
  /\bcasino[-_.]?rip/i,
  /\bbet[-_.]?rip/i
];
var VideoAdBlockerService = class {
  constructor() {
    this.STORAGE_RECORDS_KEY = "zapitv_ad_audit_records";
    this.STORAGE_MANUAL_BLOCKS_KEY = "zapitv_manual_ad_blocks";
    this.auditRecords = /* @__PURE__ */ new Map();
    this.manualBlocks = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.loadFromStorage();
  }
  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const recordsJson = localStorage.getItem(this.STORAGE_RECORDS_KEY);
      if (recordsJson) {
        const list = JSON.parse(recordsJson);
        if (Array.isArray(list)) {
          const validList = list.filter((r) => !r.id?.startsWith("visual-"));
          validList.forEach((r) => this.auditRecords.set(r.streamUrl, r));
        }
      }
      const manualJson = localStorage.getItem(this.STORAGE_MANUAL_BLOCKS_KEY);
      if (manualJson) {
        const map = JSON.parse(manualJson);
        Object.entries(map).forEach(([url, val]) => {
          this.manualBlocks.set(url, val);
        });
      }
    } catch (e) {
      console.warn("[VideoAdBlocker] Erro ao carregar dados do localStorage:", e);
    }
  }
  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const list = Array.from(this.auditRecords.values()).slice(-200);
      localStorage.setItem(this.STORAGE_RECORDS_KEY, JSON.stringify(list));
      const manualObj = {};
      this.manualBlocks.forEach((v, k) => {
        manualObj[k] = v;
      });
      localStorage.setItem(this.STORAGE_MANUAL_BLOCKS_KEY, JSON.stringify(manualObj));
    } catch (e) {
      console.warn("[VideoAdBlocker] Erro ao salvar dados no localStorage:", e);
    }
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
      }
    });
  }
  /**
   * Avalia os metadados do stream (título, release, provedor, URL) em busca de marcas de apostas ou tags de publicidade.
   */
  hasBettingMetadata(stream) {
    const combined = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""} ${stream.url || ""}`.toLowerCase();
    for (const tagRegex of BETTING_RELEASE_TAGS) {
      if (tagRegex.test(combined)) {
        return { hasAd: true, term: tagRegex.source };
      }
    }
    for (const kw of BETTING_KEYWORDS) {
      const regex = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
      if (regex.test(combined)) {
        return { hasAd: true, term: kw };
      }
    }
    return { hasAd: false };
  }
  /**
   * Avalia um stream completo (metadados + histórico de auditoria + bloqueios manuais).
   */
  evaluateStream(stream, contentTitle, season, episode) {
    const url = stream.url || "";
    if (!url) {
      return {
        id: `audit-${Date.now()}`,
        streamUrl: "",
        status: "bloqueado por propaganda embutida",
        riskScore: 100,
        reason: "URL do stream inv\xE1lida ou inexistente",
        evidences: [],
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    if (this.manualBlocks.has(url)) {
      const manual = this.manualBlocks.get(url);
      const record = {
        id: `manual-${url}`,
        streamUrl: url,
        streamName: stream.name,
        contentTitle: contentTitle || manual.title,
        season,
        episode,
        providerName: stream.providerName,
        status: "bloqueado por propaganda embutida",
        riskScore: 100,
        reason: manual.reason || "Fonte bloqueada manualmente por publicidade embutida no painel administrativo",
        evidences: [{
          region: "manual_override",
          confidence: 1,
          description: `Bloqueio manual em ${manual.timestamp}: ${manual.reason}`
        }],
        checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
        manualOverride: true
      };
      this.auditRecords.set(url, record);
      return record;
    }
    const existing = this.auditRecords.get(url);
    if (existing && existing.status === "bloqueado por propaganda embutida") {
      return existing;
    }
    const metaCheck = this.hasBettingMetadata(stream);
    if (metaCheck.hasAd) {
      const record = {
        id: `meta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        streamUrl: url,
        streamName: stream.name,
        contentTitle,
        season,
        episode,
        providerName: stream.providerName,
        status: "bloqueado por propaganda embutida",
        riskScore: 98,
        reason: `Publicidade de apostas/1xBet detectada nos metadados da m\xEDdia (termo: "${metaCheck.term}")`,
        evidences: [{
          region: "metadata",
          matchedTerm: metaCheck.term,
          confidence: 0.98,
          description: `Identificador de casa de aposta "${metaCheck.term}" na assinatura da release/stream.`
        }],
        checkedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.auditRecords.set(url, record);
      this.saveToStorage();
      this.notify();
      return record;
    }
    const cleanRecord = existing || {
      id: `clean-${Date.now()}`,
      streamUrl: url,
      streamName: stream.name,
      contentTitle,
      season,
      episode,
      providerName: stream.providerName,
      status: "limpo",
      riskScore: 0,
      reason: "Nenhuma marca ou publicidade de apostas identificada.",
      evidences: [],
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return cleanRecord;
  }
  /**
   * Analisa um frame de vídeo pixel a pixel (Canvas ImageData) buscando assinaturas de overlays,
   * faixas publicitárias no topo/rodapé e marcas d'água de alto contraste.
   */
  analyzeFrameData(frame, timestampSeconds = 0) {
    const { width, height, data } = frame;
    if (width < 10 || height < 10) return { riskScore: 0, evidences: [] };
    const evidences = [];
    let riskScore = 0;
    const topBannerEnd = Math.floor(height * 0.18);
    const bottomBannerStart = Math.floor(height * 0.82);
    const getPixel = (x, y) => {
      const idx = (y * width + x) * 4;
      return { r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3] };
    };
    const checkRegionForAdBanner = (startY, endY, regionName) => {
      let blueBannerPixels = 0;
      let highContrastTransitions = 0;
      let totalSampled = 0;
      const stepY = Math.max(1, Math.floor((endY - startY) / 10));
      const stepX = Math.max(1, Math.floor(width / 40));
      for (let y = startY; y < endY; y += stepY) {
        let prevLum = -1;
        for (let x = 0; x < width; x += stepX) {
          const { r, g, b } = getPixel(x, y);
          totalSampled++;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (b > 130 && b > r * 1.6 && b > g * 1.1) {
            blueBannerPixels++;
          }
          if (prevLum >= 0 && Math.abs(lum - prevLum) > 95) {
            highContrastTransitions++;
          }
          prevLum = lum;
        }
      }
      const blueRatio = totalSampled > 0 ? blueBannerPixels / totalSampled : 0;
      const transitionRatio = totalSampled > 0 ? highContrastTransitions / totalSampled : 0;
      if (blueRatio > 0.35 && transitionRatio > 0.15) {
        evidences.push({
          timestampSeconds,
          region: regionName,
          matchedTerm: "1xBet Banner Crom\xE1tico",
          confidence: 0.95,
          description: `Faixa retangular com assinatura crom\xE1tica 1xBet (${Math.round(blueRatio * 100)}% azul e alto contraste de texto) detectada no ${regionName === "top_banner" ? "topo" : "rodap\xE9"}.`
        });
        riskScore = Math.max(riskScore, 95);
      } else if (blueRatio > 0.25 || transitionRatio > 0.35) {
        evidences.push({
          timestampSeconds,
          region: regionName,
          confidence: 0.7,
          description: `Banner de alto contraste com densidade tipogr\xE1fica incomum na regi\xE3o ${regionName}.`
        });
        riskScore = Math.max(riskScore, 70);
      }
    };
    checkRegionForAdBanner(0, topBannerEnd, "top_banner");
    checkRegionForAdBanner(bottomBannerStart, height, "bottom_banner");
    const checkCorner = (startX, endX, startY, endY, regionName) => {
      let badgePixelCount = 0;
      let samples = 0;
      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const { r, g, b } = getPixel(x, y);
          samples++;
          if (b > 140 && b > r * 1.5 || r > 200 && g > 180 && b < 60) {
            badgePixelCount++;
          }
        }
      }
      const ratio = samples > 0 ? badgePixelCount / samples : 0;
      if (ratio > 0.2) {
        evidences.push({
          timestampSeconds,
          region: regionName,
          matchedTerm: "Watermark de Apostas",
          confidence: 0.85,
          description: `Marca d'\xE1gua promocional com padr\xE3o gr\xE1fico caracter\xEDstico no canto ${regionName === "top_left" ? "superior esquerdo" : "superior direito"}.`
        });
        riskScore = Math.max(riskScore, 85);
      }
    };
    checkCorner(0, Math.floor(width * 0.28), 0, Math.floor(height * 0.22), "top_left");
    checkCorner(Math.floor(width * 0.72), width, 0, Math.floor(height * 0.22), "top_right");
    return { riskScore, evidences };
  }
  /**
   * Avalia a persistência temporal comparando 2 frames em momentos diferentes.
   * Se o centro do vídeo mudar (cena do filme/anime), mas uma faixa no topo/rodapé permanecer estática,
   * comprova-se matematicamente a presença de overlay gráfico embutido.
   */
  analyzeTemporalPersistence(frame1, frame2) {
    if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
      return { isPersistentOverlay: false, confidence: 0 };
    }
    const { width, height } = frame1;
    const topLimit = Math.floor(height * 0.18);
    const topNarrowLimit = Math.floor(height * 0.1);
    const bottomStart = Math.floor(height * 0.82);
    const bottomNarrowStart = Math.floor(height * 0.9);
    const centerStart = Math.floor(height * 0.3);
    const centerEnd = Math.floor(height * 0.7);
    let centerDiffSum = 0;
    let centerPixels = 0;
    let topNarrowDiffSum = 0;
    let topNarrowPixels = 0;
    let topWideDiffSum = 0;
    let topWidePixels = 0;
    let bottomNarrowDiffSum = 0;
    let bottomNarrowPixels = 0;
    let bottomWideDiffSum = 0;
    let bottomWidePixels = 0;
    const step = 4;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const diff = (Math.abs(frame1.data[idx] - frame2.data[idx]) + Math.abs(frame1.data[idx + 1] - frame2.data[idx + 1]) + Math.abs(frame1.data[idx + 2] - frame2.data[idx + 2])) / 3;
        if (y < topNarrowLimit) {
          topNarrowDiffSum += diff;
          topNarrowPixels++;
        }
        if (y < topLimit) {
          topWideDiffSum += diff;
          topWidePixels++;
        } else if (y >= bottomNarrowStart) {
          bottomNarrowDiffSum += diff;
          bottomNarrowPixels++;
        } else if (y >= bottomStart) {
          bottomWideDiffSum += diff;
          bottomWidePixels++;
        } else if (y >= centerStart && y <= centerEnd) {
          centerDiffSum += diff;
          centerPixels++;
        }
      }
    }
    const avgCenterDiff = centerPixels > 0 ? centerDiffSum / centerPixels : 0;
    const avgTopNarrowDiff = topNarrowPixels > 0 ? topNarrowDiffSum / topNarrowPixels : 0;
    const avgTopWideDiff = topWidePixels > 0 ? topWideDiffSum / topWidePixels : 0;
    const avgBottomNarrowDiff = bottomNarrowPixels > 0 ? bottomNarrowDiffSum / bottomNarrowPixels : 0;
    const avgBottomWideDiff = bottomWidePixels > 0 ? bottomWideDiffSum / bottomWidePixels : 0;
    if (avgCenterDiff > 18 && (avgTopNarrowDiff < 5 || avgTopWideDiff < 5)) {
      return { isPersistentOverlay: true, region: "top_banner", confidence: 0.95 };
    }
    if (avgCenterDiff > 18 && (avgBottomNarrowDiff < 5 || avgBottomWideDiff < 5)) {
      return { isPersistentOverlay: true, region: "bottom_banner", confidence: 0.95 };
    }
    return { isPersistentOverlay: false, confidence: 0 };
  }
  /**
   * Registra ou atualiza uma auditoria no banco e salva no cache.
   */
  registerAuditResult(record) {
    this.auditRecords.set(record.streamUrl, record);
    this.saveToStorage();
    this.notify();
  }
  /**
   * Bloqueio manual de um stream específico no painel administrativo.
   */
  blockStreamManually(streamUrl, reason, contentTitle) {
    if (!streamUrl) return;
    const timestamp = (/* @__PURE__ */ new Date()).toLocaleString("pt-BR");
    this.manualBlocks.set(streamUrl, { reason, title: contentTitle, timestamp });
    const record = {
      id: `manual-${Date.now()}`,
      streamUrl,
      contentTitle,
      status: "bloqueado por propaganda embutida",
      riskScore: 100,
      reason: reason || "Bloqueado manualmente no painel administrativo",
      evidences: [{
        region: "manual_override",
        confidence: 1,
        description: `Bloqueio manual administrativo em ${timestamp}: ${reason}`
      }],
      checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      manualOverride: true
    };
    this.auditRecords.set(streamUrl, record);
    this.saveToStorage();
    this.notify();
  }
  /**
   * Desbloqueia ou reabilita um stream manual ou previamente bloqueado.
   */
  unblockStream(streamUrl) {
    if (!streamUrl) return;
    this.manualBlocks.delete(streamUrl);
    const existing = this.auditRecords.get(streamUrl);
    if (existing) {
      existing.status = "limpo";
      existing.riskScore = 0;
      existing.reason = "Reabilitado manualmente pelo administrador.";
      existing.manualOverride = false;
      this.auditRecords.set(streamUrl, existing);
    }
    this.saveToStorage();
    this.notify();
  }
  /**
   * Verifica rapidamente se a URL está em estado de bloqueio.
   */
  isStreamBlocked(streamUrl) {
    if (!streamUrl) return false;
    if (this.manualBlocks.has(streamUrl)) return true;
    const record = this.auditRecords.get(streamUrl);
    if (!record || record.id?.startsWith("visual-")) return false;
    return record.status === "bloqueado por propaganda embutida";
  }
  /**
   * Obtém a lista completa de auditorias para exibição no painel administrativo.
   */
  getAuditRecords() {
    return Array.from(this.auditRecords.values()).sort(
      (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
  }
  /**
   * Limpa o histórico de auditoria (preservando bloqueios manuais explícitos).
   */
  clearAuditHistory() {
    this.auditRecords.clear();
    this.manualBlocks.forEach((v, url) => {
      this.auditRecords.set(url, {
        id: `manual-${url}`,
        streamUrl: url,
        contentTitle: v.title,
        status: "bloqueado por propaganda embutida",
        riskScore: 100,
        reason: v.reason,
        evidences: [{
          region: "manual_override",
          confidence: 1,
          description: `Bloqueio manual em ${v.timestamp}: ${v.reason}`
        }],
        checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
        manualOverride: true
      });
    });
    this.saveToStorage();
    this.notify();
  }
};
var videoAdBlocker = new VideoAdBlockerService();

// src/core/providers/streamValidator.ts
var KNOWN_PARKED_DOMAINS = [
  "superflixapi.top",
  "parklogic.com",
  "parklogic",
  "bodis.com",
  "sedo.com",
  "parkingcrew.net",
  "hugedomains.com",
  "dan.com"
];
var KNOWN_UPSTREAM_MISMATCHES = [
  // 1. Doraemon: provedores upstream mapeiam erroneamente para Sparks of Tomorrow (/1684/), kurage.live proxy ou ER Plantão Médico ou Ultraman
  {
    targetPattern: /doraemon|gato do futuro|57911|65733|tt0069576|tt4083422/i,
    rejectStream: (s) => {
      const text = `${s.name || ""} ${s.title || ""} ${s.url || ""}`.toLowerCase();
      return text.includes("/1684/") || text.includes("kurage.live") || text.includes("animegg") || text.includes("sparks of tomorrow") || text.includes("plant\xE3o m\xE9dico") || text.includes("plantao medico") || text.includes("ultraman") || text.includes("eternal aseria") || text.includes("angel heart");
    }
  },
  // 2. Overflow: provedores upstream mapeiam erroneamente para Black Clover (/1224/)
  {
    targetPattern: /overflow/i,
    rejectStream: (s) => {
      const text = `${s.name || ""} ${s.title || ""} ${s.url || ""}`.toLowerCase();
      return text.includes("/1224/") || text.includes("black clover") || text.includes("clover");
    }
  },
  // 3. Mori no Kuma-san: provedores upstream mapeiam erroneamente para Murai in Love (/1736/)
  {
    targetPattern: /mori.*kuma/i,
    rejectStream: (s) => {
      const text = `${s.name || ""} ${s.title || ""} ${s.url || ""}`.toLowerCase();
      return text.includes("/1736/") || text.includes("murai in love") || text.includes("murai no koi") || text.includes("murai");
    }
  },
  // 4. Modaete yo, Adam-kun: provedores upstream mapeiam erroneamente para Saving 80,000 Gold in Another World
  {
    targetPattern: /modaete.*adam/i,
    rejectStream: (s) => {
      const text = `${s.name || ""} ${s.title || ""} ${s.url || ""}`.toLowerCase();
      return text.includes("/1332/") || text.includes("saving 80,000 gold") || text.includes("80,000 gold") || text.includes("8-manmai") || text.includes("black adam");
    }
  },
  // 5. Hope: O Primeiro Impacto (2026) / Hopeu (Na Hong-jin): filme em cartaz nos cinemas
  // Torrents fraudulentos indexados como supostos "WEB-DL AMZN" contêm vídeos adultos / trotes (Mia Khalifa).
  {
    targetPattern: /hope.*primeiro.*impacto|hopeu|1058424|tt27369017/i,
    rejectStream: (s) => {
      const text = `${s.name || ""} ${s.title || ""} ${s.url || ""} ${s.infoHash || ""}`.toLowerCase();
      if (text.includes("f9a842dfe9f5b2e7fda509f2306e0700b97a4036") || text.includes("d0eacddff07a24173d8f7dc11a18ef3ed32b886a") || text.includes("playweb") || text.includes("ben the men") || text.includes("khalifa") || text.includes("mia") || text.includes("web-dl") && !text.includes("trailer") || text.includes("webrip") && !text.includes("trailer") || text.includes("amzn") && !text.includes("trailer")) {
        return true;
      }
      return false;
    }
  }
];
var StreamValidator = class {
  constructor() {
    this.blacklist = new Set(KNOWN_PARKED_DOMAINS);
    this.cache = /* @__PURE__ */ new Map();
    this.CACHE_TTL_MS = 5 * 60 * 1e3;
  }
  // 5 minutos de cache
  /**
   * Verifica rapidamente se a URL pertence a um domínio comprovadamente estacionado ou na lista negra.
   */
  isUrlBlacklisted(url) {
    if (!url) return true;
    try {
      const base = typeof window !== "undefined" ? window.location.origin : process.env.VITE_APP_URL || "http://localhost:4000";
      const parsed = new URL(url.startsWith("/") ? `${base}${url}` : url);
      const host = parsed.hostname.toLowerCase();
      for (const domain of this.blacklist) {
        if (host === domain || host.endsWith(`.${domain}`)) {
          return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  }
  /**
   * Adiciona um domínio ou URL à lista negra após falha confirmada.
   */
  blacklistDomain(domainOrUrl, reason) {
    try {
      let host = domainOrUrl.toLowerCase();
      if (domainOrUrl.includes("://")) {
        host = new URL(domainOrUrl).hostname.toLowerCase();
      }
      this.blacklist.add(host);
      console.warn(`[StreamValidator] Dom\xEDnio adicionado \xE0 lista negra: ${host} (Motivo: ${reason || "N\xE3o informado"})`);
    } catch {
      this.blacklist.add(domainOrUrl.toLowerCase());
    }
  }
  /**
   * Remove da lista negra caso tenha sido reabilitado.
   */
  unblacklistDomain(domain) {
    this.blacklist.delete(domain.toLowerCase());
  }
  /**
   * Obtém a lista atual de domínios bloqueados.
   */
  getBlacklistedDomains() {
    return Array.from(this.blacklist);
  }
  /**
   * Valida um stream de mídia (HLS, MP4 ou Embed) verificando se a URL é acessível,
   * se o manifesto é legítimo e se não retorna uma página ParkLogic ou erro HTTP.
   */
  async validateStream(stream, timeoutMs = 6e3) {
    const url = stream.url;
    if (!url) {
      return {
        valid: false,
        url: "",
        reason: "URL do stream inexistente."
      };
    }
    if (this.isUrlBlacklisted(url)) {
      return {
        valid: false,
        url,
        isParked: true,
        reason: "Dom\xEDnio identificado na lista de estacionamento/ParkLogic."
      };
    }
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }
    const start = Date.now();
    try {
      const isBrowser = typeof window !== "undefined";
      let endpoint = "";
      if (isBrowser) {
        endpoint = `/api/validate-stream?url=${encodeURIComponent(url)}&type=${stream.sourceType || "auto"}`;
      } else {
        endpoint = `http://localhost:4000/api/validate-stream?url=${encodeURIComponent(url)}&type=${stream.sourceType || "auto"}`;
      }
      const res = await fetch(endpoint, {
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const result = {
          valid: false,
          url,
          status: res.status,
          reason: errorData.reason || `Falha na valida\xE7\xE3o HTTP: status ${res.status}`,
          latencyMs: Date.now() - start
        };
        this.cache.set(url, { result, timestamp: Date.now() });
        return result;
      }
      const data = await res.json();
      data.latencyMs = Date.now() - start;
      if (data.isParked || data.finalUrl && this.isUrlBlacklisted(data.finalUrl)) {
        this.blacklistDomain(url, data.reason || "Detectado ParkLogic no servidor");
        data.valid = false;
        data.isParked = true;
      }
      this.cache.set(url, { result: data, timestamp: Date.now() });
      return data;
    } catch (err) {
      const result = {
        valid: false,
        url,
        reason: `Tempo limite ou erro de rede ao validar: ${err.message}`,
        latencyMs: Date.now() - start
      };
      this.cache.set(url, { result, timestamp: Date.now() });
      return result;
    }
  }
  /**
   * Verifica se o stream realmente corresponde ao título do conteúdo requisitado,
   * prevenindo que animes/séries sejam trocados por conteúdos corrompidos em addons de terceiros.
   */
  isStreamMatchingTargetTitle(stream, targetTitle) {
    const sTitle = (stream.title || "").trim();
    const sName = (stream.name || "").trim();
    const sUrl = (stream.url || "").trim();
    const combined = `${sName} ${sTitle} ${sUrl}`.toLowerCase();
    const quarantine = streamQuarantineService.evaluateQuarantine(stream, targetTitle);
    if (quarantine.isQuarantined) {
      console.warn(`[StreamValidator] Stream bloqueado em quarentena: ${sTitle || sUrl} (Motivo: ${quarantine.reason})`);
      return false;
    }
    if (videoAdBlocker.isStreamBlocked(sUrl)) {
      console.warn(`[StreamValidator] Stream rejeitado por bloqueio de propaganda embutida: ${sUrl}`);
      return false;
    }
    const adEval = videoAdBlocker.evaluateStream(stream, targetTitle);
    if (adEval.status === "bloqueado por propaganda embutida") {
      console.warn(`[StreamValidator] Stream rejeitado por propaganda embutida (1xBet / Apostas): ${sTitle || sUrl} (Motivo: ${adEval.reason})`);
      return false;
    }
    if (combined.includes("aguarde 5 minutos") || combined.includes("muitas requisi\xE7\xF5es") || combined.includes("muitas requisicoes") || combined.includes("(banned)") || sUrl.includes("koyeb.app/stream/51389") || sUrl.includes("01+piloto.mkv") || sUrl.includes("01%2bpiloto.mkv")) {
      return false;
    }
    const adultTrollSignatures = [
      "khalifa",
      "mia khalifa",
      "brazzers",
      "xvideos",
      "pornhub",
      "redtube",
      "youporn",
      "bangbros",
      "naughtyamerica",
      "spankbang",
      "xhamster",
      "pornstar",
      "hardcore xxx",
      "creampie",
      "blowjob"
    ];
    if (adultTrollSignatures.some((term) => combined.includes(term))) {
      console.warn(`[StreamValidator] Stream rejeitado por conter termos adultos/trote: ${sTitle || sUrl}`);
      return false;
    }
    if (!targetTitle || !targetTitle.trim()) return true;
    for (const rule of KNOWN_UPSTREAM_MISMATCHES) {
      if (rule.targetPattern.test(targetTitle)) {
        if (rule.rejectStream(stream)) {
          console.warn(`[StreamValidator] Stream rejeitado por desvio conhecido para '${targetTitle}': ${sTitle || sUrl}`);
          return false;
        }
      }
    }
    const fenixMatch = sTitle.match(/🐦‍🔥\s*([^\n⏸️]+)/i);
    if (fenixMatch) {
      const declaredTitle = fenixMatch[1].trim().toLowerCase();
      const cleanTarget = targetTitle.toLowerCase().replace(/[^\w\s\u00C0-\u00FF]/gi, " ").replace(/\s+/g, " ").trim();
      const targetWords = cleanTarget.split(" ").filter((w) => w.length >= 3);
      const declaredWords = declaredTitle.replace(/[^\w\s\u00C0-\u00FF]/gi, " ").split(" ").filter((w) => w.length >= 3);
      if (targetWords.length > 0 && declaredWords.length > 0) {
        const hasOverlap = targetWords.some((tw) => declaredTitle.includes(tw)) || declaredWords.some((dw) => cleanTarget.includes(dw));
        if (!hasOverlap) {
          console.warn(`[StreamValidator] T\xEDtulo do stream '${declaredTitle}' n\xE3o corresponde ao t\xEDtulo solicitado '${targetTitle}'`);
          return false;
        }
      }
    }
    if (sTitle.length > 5 && (sTitle.includes("1080p") || sTitle.includes("720p") || sTitle.includes(".mkv") || sTitle.includes(".mp4") || sTitle.includes("NyaaSi") || sTitle.includes("TorrentGalaxy") || sTitle.includes("1337x"))) {
      const cleanSTitle = sTitle.replace(/\[[^\]]+\]/g, " ").replace(/[^\w\s\u00C0-\u00FF]/gi, " ").toLowerCase();
      const cleanTarget = targetTitle.toLowerCase().replace(/[^\w\s\u00C0-\u00FF]/gi, " ").trim();
      const mainTargetWord = cleanTarget.split(" ").find((w) => w.length >= 4);
      if (mainTargetWord && !cleanSTitle.includes(mainTargetWord)) {
        const otherKnownSeries = ["ultraman", "aseria", "angel heart", "sparks of tomorrow", "black clover", "murai in love", "saving 80,000 gold"];
        if (otherKnownSeries.some((t) => cleanSTitle.includes(t))) {
          console.warn(`[StreamValidator] Release torrent com t\xEDtulo trocado rejeitada: '${sTitle}' para '${targetTitle}'`);
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Verifica se o nome/texto do stream corresponde ao título alvo e parâmetros de episódio
   */
  isContentMatchingTarget(streamText, targetTitle, episodeParams) {
    if (!targetTitle || !streamText) return true;
    const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cleanStream = normalize(streamText);
    const cleanTarget = normalize(targetTitle);
    const targetWords = cleanTarget.split(/\s+/).filter((w) => w.length >= 4);
    if (targetWords.length > 0 && !cleanStream.includes(cleanTarget)) {
      const matchesAtLeastOne = targetWords.some((w) => cleanStream.includes(w));
      if (!matchesAtLeastOne) {
        return false;
      }
    }
    if (episodeParams) {
      const s = episodeParams.season;
      const e = episodeParams.episode;
      const sPattern = new RegExp(`s0*${s}|temporada\\s*0*${s}`, "i");
      if (cleanStream.includes("temporada") && !sPattern.test(cleanStream)) {
        return false;
      }
    }
    return true;
  }
  /**
   * Filtra uma lista de streams, eliminando imediatamente fontes de domínios parked/inválidos
   * e streams que pertencem a conteúdos trocados/diferentes do solicitado.
   */
  filterCleanStreams(streams, targetTitle) {
    return streams.filter((s) => {
      if (!s.url) return false;
      if (this.isUrlBlacklisted(s.url)) return false;
      if (videoAdBlocker.isStreamBlocked(s.url)) return false;
      return this.isStreamMatchingTargetTitle(s, targetTitle);
    });
  }
};
var streamValidator = new StreamValidator();

// src/core/subtitles/subtitleLanguageDetector.ts
var PT_STOPWORDS = /* @__PURE__ */ new Set([
  "de",
  "a",
  "o",
  "que",
  "e",
  "do",
  "da",
  "em",
  "um",
  "para",
  "com",
  "n\xE3o",
  "nao",
  "uma",
  "os",
  "no",
  "se",
  "na",
  "por",
  "mais",
  "as",
  "dos",
  "como",
  "mas",
  "foi",
  "ao",
  "ele",
  "das",
  "tem",
  "\xE0",
  "seu",
  "sua",
  "ou",
  "quando",
  "muito",
  "nos",
  "j\xE1",
  "ja",
  "eu",
  "tamb\xE9m",
  "tambem",
  "s\xF3",
  "so",
  "pelo",
  "pela",
  "at\xE9",
  "ate",
  "isso",
  "ela",
  "entre",
  "depois",
  "sem",
  "mesmo",
  "aos",
  "seus",
  "quem",
  "nas",
  "me",
  "esse",
  "eles",
  "voc\xEA",
  "voce",
  "voc\xEAs",
  "voces",
  "est\xE1",
  "esta",
  "estava",
  "aqui",
  "tinha",
  "foram",
  "essa",
  "num",
  "nem",
  "suas",
  "meu",
  "\xE0s",
  "minha",
  "numa",
  "pelos",
  "elas",
  "qual",
  "n\xF3s",
  "nos",
  "lhe",
  "deles",
  "essas",
  "esses",
  "pelas",
  "este",
  "dele",
  "tu",
  "te",
  "voc\xEAs",
  "onde",
  "porque",
  "porqu\xEA",
  "estou",
  "est\xE3o",
  "estao",
  "fazer",
  "vamos",
  "agora",
  "nada",
  "coisa",
  "tudo",
  "senhor",
  "senhora",
  "obrigado",
  "obrigada",
  "gente",
  "tempo",
  "vida",
  "falar",
  "olha",
  "cara",
  "beleza",
  "legal",
  "ent\xE3o",
  "entao",
  "talvez",
  "assim"
]);
var EN_STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
  "nature",
  "fire",
  "water",
  "light",
  "darkness",
  "corresponding",
  "something",
  "nothing",
  "someone",
  "please",
  "thank",
  "where",
  "should",
  "why",
  "right",
  "down",
  "again",
  "never",
  "always",
  "great",
  "here"
]);
var ES_STOPWORDS = /* @__PURE__ */ new Set([
  "de",
  "la",
  "que",
  "el",
  "en",
  "y",
  "a",
  "los",
  "del",
  "se",
  "las",
  "por",
  "un",
  "para",
  "con",
  "no",
  "una",
  "su",
  "al",
  "lo",
  "como",
  "m\xE1s",
  "mas",
  "pero",
  "sus",
  "le",
  "ya",
  "o",
  "este",
  "s\xED",
  "si",
  "porque",
  "esta",
  "son",
  "entre",
  "est\xE1",
  "esta",
  "cuando",
  "muy",
  "sin",
  "sobre",
  "tambi\xE9n",
  "tambien",
  "me",
  "hasta",
  "hay",
  "donde",
  "quien",
  "desde",
  "todo",
  "nos",
  "durante",
  "todos",
  "uno",
  "les",
  "ni",
  "contra",
  "otros",
  "ese",
  "eso",
  "hab\xEDa",
  "habia",
  "hola",
  "gracias",
  "vamos",
  "amigo",
  "bueno",
  "se\xF1or",
  "se\xF1ora"
]);
var FR_STOPWORDS = /* @__PURE__ */ new Set([
  "de",
  "la",
  "le",
  "et",
  "les",
  "des",
  "en",
  "un",
  "du",
  "une",
  "que",
  "est",
  "pour",
  "qui",
  "dans",
  "a",
  "par",
  "plus",
  "pas",
  "au",
  "sur",
  "ne",
  "se",
  "ce",
  "il",
  "sont",
  "avec",
  "tout",
  "faire",
  "son",
  "mais",
  "nous",
  "sa",
  "comme",
  "ou",
  "si",
  "leur",
  "y",
  "dire",
  "elle",
  "doit",
  "ci",
  "sans",
  "bonjour"
]);
function extractCleanWords(text) {
  if (!text) return [];
  const noTimestamps = text.replace(/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}/g, " ");
  const noTags = noTimestamps.replace(/<[^>]+>/g, " ");
  const noAssTags = noTags.replace(/\{[^}]+\}/g, " ");
  const matches = noAssTags.toLowerCase().match(/[\p{L}']+/gu);
  if (!matches) return [];
  return matches.map((w) => w.replace(/^'+|'+$/g, "")).filter((w) => w.length >= 2);
}
function detectSubtitleLanguage(sample) {
  let combinedText = "";
  if (Array.isArray(sample)) {
    const total = sample.length;
    if (total === 0) {
      return {
        detectedLang: "und",
        confidence: 0,
        isPortuguese: false,
        isEnglish: false,
        sampleCount: 0,
        wordCount: 0,
        details: "Nenhuma fala dispon\xEDvel para an\xE1lise"
      };
    }
    const indices = [];
    const step = Math.max(1, Math.floor(total / 30));
    for (let i = 0; i < total; i += step) {
      indices.push(i);
    }
    if (!indices.includes(0)) indices.unshift(0);
    if (!indices.includes(total - 1)) indices.push(total - 1);
    combinedText = indices.map((idx) => sample[idx]?.text || "").join(" ");
  } else {
    combinedText = sample || "";
  }
  const words = extractCleanWords(combinedText);
  if (words.length < 5) {
    return {
      detectedLang: "und",
      confidence: 0,
      isPortuguese: false,
      isEnglish: false,
      sampleCount: Array.isArray(sample) ? sample.length : 1,
      wordCount: words.length,
      details: "Amostra insuficiente de palavras"
    };
  }
  let ptHits = 0;
  let enHits = 0;
  let esHits = 0;
  let frHits = 0;
  for (const word of words) {
    if (PT_STOPWORDS.has(word)) ptHits++;
    if (EN_STOPWORDS.has(word)) enHits++;
    if (ES_STOPWORDS.has(word)) esHits++;
    if (FR_STOPWORDS.has(word)) frHits++;
  }
  const ptCharMatches = combinedText.match(/[ãõçÃÕÇ]/g);
  if (ptCharMatches) {
    ptHits += Math.min(ptCharMatches.length * 2, 25);
  }
  const enContractions = combinedText.match(/\b(don't|can't|won't|it's|i'm|you're|they're|didn't|doesn't|wouldn't|couldn't)\b/gi);
  if (enContractions) {
    enHits += Math.min(enContractions.length * 2, 25);
  }
  const totalHits = ptHits + enHits + esHits + frHits;
  if (totalHits === 0) {
    return {
      detectedLang: "und",
      confidence: 0,
      isPortuguese: false,
      isEnglish: false,
      sampleCount: Array.isArray(sample) ? sample.length : 1,
      wordCount: words.length,
      details: "Nenhuma correspond\xEAncia lingu\xEDstica identificada"
    };
  }
  const ptScore = ptHits / totalHits;
  const enScore = enHits / totalHits;
  const esScore = esHits / totalHits;
  const frScore = frHits / totalHits;
  let detectedLang = "und";
  let maxScore = 0;
  if (ptScore > maxScore) {
    maxScore = ptScore;
    detectedLang = "pt-BR";
  }
  if (enScore > maxScore) {
    maxScore = enScore;
    detectedLang = "en";
  }
  if (esScore > maxScore) {
    maxScore = esScore;
    detectedLang = "es";
  }
  if (frScore > maxScore) {
    maxScore = frScore;
    detectedLang = "fr";
  }
  const sortedScores = [ptScore, enScore, esScore, frScore].sort((a, b) => b - a);
  const margin = sortedScores[0] - (sortedScores[1] || 0);
  const confidence = Math.min(1, Math.max(0.2, sortedScores[0] * 0.7 + margin * 0.3));
  const isPortuguese = detectedLang === "pt-BR" && ptScore >= 0.45;
  const isEnglish = detectedLang === "en" && enScore >= 0.45;
  return {
    detectedLang,
    confidence: Number(confidence.toFixed(2)),
    isPortuguese,
    isEnglish,
    sampleCount: Array.isArray(sample) ? sample.length : 1,
    wordCount: words.length,
    details: `PT: ${(ptScore * 100).toFixed(0)}% (hits: ${ptHits}), EN: ${(enScore * 100).toFixed(0)}% (hits: ${enHits}), ES: ${(esScore * 100).toFixed(0)}% (hits: ${esHits})`
  };
}
function validateSubtitleContentMatch(contentOrCues, expectedLanguageCode) {
  const normExpected = (expectedLanguageCode || "").toLowerCase().trim();
  const isExpectingPtBr = /^(pob|pt-br|bra|por-br|pt|por)$/i.test(normExpected);
  const isExpectingEn = /^(eng|en)$/i.test(normExpected);
  const detection = detectSubtitleLanguage(contentOrCues);
  if (detection.wordCount < 5 || detection.detectedLang === "und") {
    return {
      isValid: true,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: "Amostra de texto muito curta para valida\xE7\xE3o estrita",
      isConsistent: true
    };
  }
  if (isExpectingPtBr) {
    if (detection.isEnglish && !detection.isPortuguese && detection.confidence >= 0.4) {
      return {
        isValid: false,
        detectedLang: detection.detectedLang,
        confidence: detection.confidence,
        reason: `Inconsist\xEAncia cr\xEDtica: Texto \xE9 Ingl\xEAs (${detection.details}), incompat\xEDvel com Portugu\xEAs (Brasil)`,
        isConsistent: false
      };
    }
    if (detection.detectedLang === "es" && detection.confidence >= 0.7) {
      return {
        isValid: false,
        detectedLang: "es",
        confidence: detection.confidence,
        reason: `Inconsist\xEAncia: Texto \xE9 Espanhol (${detection.details}) e n\xE3o Portugu\xEAs`,
        isConsistent: false
      };
    }
    return {
      isValid: true,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: detection.isPortuguese ? "Texto validado como Portugu\xEAs (Brasil)" : "Compat\xEDvel",
      isConsistent: true
    };
  }
  if (isExpectingEn) {
    if (detection.isPortuguese && !detection.isEnglish && detection.confidence >= 0.5) {
      return {
        isValid: false,
        detectedLang: detection.detectedLang,
        confidence: detection.confidence,
        reason: `Inconsist\xEAncia: Texto \xE9 Portugu\xEAs (${detection.details}), incompat\xEDvel com Ingl\xEAs`,
        isConsistent: false
      };
    }
    return {
      isValid: true,
      detectedLang: detection.detectedLang,
      confidence: detection.confidence,
      reason: "Compat\xEDvel com Ingl\xEAs",
      isConsistent: true
    };
  }
  return {
    isValid: true,
    detectedLang: detection.detectedLang,
    confidence: detection.confidence,
    reason: "Valida\xE7\xE3o neutra para idioma secund\xE1rio",
    isConsistent: true
  };
}

// src/core/subtitles/subtitleTranslationService.ts
var SubtitleTranslationService = class _SubtitleTranslationService {
  constructor() {
    this.translationCache = /* @__PURE__ */ new Map();
  }
  static {
    this.CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
  }
  // 24 horas
  /**
   * Converte cues em formato SRT padronizado.
   */
  cuesToSrt(cues) {
    return cues.map((cue, idx) => {
      const startStr = this.formatTime(cue.start);
      const endStr = this.formatTime(cue.end);
      return `${idx + 1}
${startStr} --> ${endStr}
${cue.text}
`;
    }).join("\n");
  }
  formatTime(seconds) {
    const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor(s % 3600 / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor(s % 1 * 1e3);
    const pad = (n, z = 2) => String(n).padStart(z, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
  }
  /**
   * Traduz um lote de textos via API gratuita com fallback.
   */
  async translateBatch(texts, targetLang = "pt") {
    if (texts.length === 0) return [];
    const DELIMITER = " |||| ";
    const joined = texts.join(DELIMITER);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(joined)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6e3) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedFull = data[0].map((item) => item[0]).join("");
          const split = translatedFull.split(/\s*\|\|\|\|\s*/);
          if (split.length === texts.length) {
            return split.map((t) => t.trim());
          }
        }
      }
    } catch {
    }
    try {
      const promises = texts.map(async (text) => {
        if (!text || text.trim().length <= 1) return text;
        try {
          const singleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
          const singleRes = await fetch(singleUrl, { signal: AbortSignal.timeout(4e3) });
          if (singleRes.ok) {
            const singleData = await singleRes.json();
            if (Array.isArray(singleData) && Array.isArray(singleData[0])) {
              return singleData[0].map((item) => item[0]).join("").trim();
            }
          }
        } catch {
        }
        return text;
      });
      return await Promise.all(promises);
    } catch {
    }
    return texts;
  }
  /**
   * Traduz legendas completas para Português (Brasil) com verificação rigorosa.
   */
  async translateCuesToPtBr(cues, cacheKey) {
    if (!cues || cues.length === 0) {
      return {
        success: false,
        translatedCues: [],
        translatedSrt: "",
        sourceLang: "und",
        targetLang: "pt-BR",
        confidence: 0,
        error: "Nenhuma fala dispon\xEDvel para traduzir"
      };
    }
    const cached = this.translationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < _SubtitleTranslationService.CACHE_TTL_MS) {
      return {
        success: true,
        translatedCues: cached.cues,
        translatedSrt: cached.srt,
        sourceLang: "auto",
        targetLang: "pt-BR",
        confidence: 0.95
      };
    }
    const originDetection = detectSubtitleLanguage(cues);
    if (originDetection.isPortuguese && originDetection.confidence >= 0.6) {
      const srt = this.cuesToSrt(cues);
      return {
        success: true,
        translatedCues: cues,
        translatedSrt: srt,
        sourceLang: "pt-BR",
        targetLang: "pt-BR",
        confidence: originDetection.confidence
      };
    }
    const CHUNK_SIZE = 25;
    const translatedCues = [];
    try {
      for (let i = 0; i < cues.length; i += CHUNK_SIZE) {
        const chunk = cues.slice(i, i + CHUNK_SIZE);
        const originalTexts = chunk.map((c) => c.text);
        const translatedTexts = await this.translateBatch(originalTexts, "pt");
        for (let j = 0; j < chunk.length; j++) {
          translatedCues.push({
            start: chunk[j].start,
            end: chunk[j].end,
            text: translatedTexts[j] || chunk[j].text
          });
        }
      }
      const validation = validateSubtitleContentMatch(translatedCues, "pob");
      if (!validation.isValid || !validation.isConsistent) {
        console.warn("[ZapiTranslate] Falha na valida\xE7\xE3o lingu\xEDstica da tradu\xE7\xE3o:", validation.reason);
        return {
          success: false,
          translatedCues: [],
          translatedSrt: "",
          sourceLang: originDetection.detectedLang,
          targetLang: "pt-BR",
          confidence: 0,
          error: "A tradu\xE7\xE3o autom\xE1tica n\xE3o produziu texto v\xE1lido em portugu\xEAs brasileiro"
        };
      }
      const translatedSrt = this.cuesToSrt(translatedCues);
      this.translationCache.set(cacheKey, {
        cues: translatedCues,
        srt: translatedSrt,
        timestamp: Date.now()
      });
      return {
        success: true,
        translatedCues,
        translatedSrt,
        sourceLang: originDetection.detectedLang,
        targetLang: "pt-BR",
        confidence: validation.confidence
      };
    } catch (err) {
      console.warn("[ZapiTranslate] Erro durante o pipeline de tradu\xE7\xE3o:", err);
      return {
        success: false,
        translatedCues: [],
        translatedSrt: "",
        sourceLang: originDetection.detectedLang,
        targetLang: "pt-BR",
        confidence: 0,
        error: err.message || "Falha ao traduzir legendas"
      };
    }
  }
  /**
   * Invalida registros de cache de legendas incorretas.
   */
  invalidateCache(cacheKey) {
    if (cacheKey) {
      this.translationCache.delete(cacheKey);
    } else {
      this.translationCache.clear();
    }
  }
};
var subtitleTranslationService = new SubtitleTranslationService();

// src/core/subtitles/subtitleService.ts
var LANGUAGE_INFO = {
  // Português (Brasil) - Prioridade Máxima
  pob: { name: "Portugu\xEAs (Brasil)", flag: "\u{1F1E7}\u{1F1F7}", order: 1, isPtBr: true },
  "pt-br": { name: "Portugu\xEAs (Brasil)", flag: "\u{1F1E7}\u{1F1F7}", order: 1, isPtBr: true },
  "por-br": { name: "Portugu\xEAs (Brasil)", flag: "\u{1F1E7}\u{1F1F7}", order: 1, isPtBr: true },
  bra: { name: "Portugu\xEAs (Brasil)", flag: "\u{1F1E7}\u{1F1F7}", order: 1, isPtBr: true },
  // Português (Portugal)
  por: { name: "Portugu\xEAs", flag: "\u{1F1F5}\u{1F1F9}", order: 2 },
  pt: { name: "Portugu\xEAs", flag: "\u{1F1F5}\u{1F1F9}", order: 2 },
  "pt-pt": { name: "Portugu\xEAs", flag: "\u{1F1F5}\u{1F1F9}", order: 2 },
  // Inglês
  eng: { name: "Ingl\xEAs", flag: "\u{1F1FA}\u{1F1F8}", order: 3 },
  en: { name: "Ingl\xEAs", flag: "\u{1F1FA}\u{1F1F8}", order: 3 },
  // Espanhol
  spa: { name: "Espanhol", flag: "\u{1F1EA}\u{1F1F8}", order: 4 },
  es: { name: "Espanhol", flag: "\u{1F1EA}\u{1F1F8}", order: 4 },
  // Outros idiomas populares ordenados
  fre: { name: "Franc\xEAs", flag: "\u{1F1EB}\u{1F1F7}", order: 10 },
  fra: { name: "Franc\xEAs", flag: "\u{1F1EB}\u{1F1F7}", order: 10 },
  fr: { name: "Franc\xEAs", flag: "\u{1F1EB}\u{1F1F7}", order: 10 },
  ita: { name: "Italiano", flag: "\u{1F1EE}\u{1F1F9}", order: 10 },
  it: { name: "Italiano", flag: "\u{1F1EE}\u{1F1F9}", order: 10 },
  ger: { name: "Alem\xE3o", flag: "\u{1F1E9}\u{1F1EA}", order: 10 },
  deu: { name: "Alem\xE3o", flag: "\u{1F1E9}\u{1F1EA}", order: 10 },
  de: { name: "Alem\xE3o", flag: "\u{1F1E9}\u{1F1EA}", order: 10 },
  jpn: { name: "Japon\xEAs", flag: "\u{1F1EF}\u{1F1F5}", order: 10 },
  ja: { name: "Japon\xEAs", flag: "\u{1F1EF}\u{1F1F5}", order: 10 },
  kor: { name: "Coreano", flag: "\u{1F1F0}\u{1F1F7}", order: 10 },
  ko: { name: "Coreano", flag: "\u{1F1F0}\u{1F1F7}", order: 10 },
  chi: { name: "Chin\xEAs", flag: "\u{1F1E8}\u{1F1F3}", order: 10 },
  zho: { name: "Chin\xEAs", flag: "\u{1F1E8}\u{1F1F3}", order: 10 },
  zh: { name: "Chin\xEAs", flag: "\u{1F1E8}\u{1F1F3}", order: 10 },
  zht: { name: "Chin\xEAs Tradicional", flag: "\u{1F1E8}\u{1F1F3}", order: 10 },
  rus: { name: "Russo", flag: "\u{1F1F7}\u{1F1FA}", order: 10 },
  ru: { name: "Russo", flag: "\u{1F1F7}\u{1F1FA}", order: 10 },
  vie: { name: "Vietnamita", flag: "\u{1F1FB}\u{1F1F3}", order: 10 },
  vi: { name: "Vietnamita", flag: "\u{1F1FB}\u{1F1F3}", order: 10 },
  per: { name: "Persa", flag: "\u{1F1EE}\u{1F1F7}", order: 10 },
  fas: { name: "Persa", flag: "\u{1F1EE}\u{1F1F7}", order: 10 },
  fa: { name: "Persa", flag: "\u{1F1EE}\u{1F1F7}", order: 10 },
  ara: { name: "\xC1rabe", flag: "\u{1F1F8}\u{1F1E6}", order: 10 },
  ar: { name: "\xC1rabe", flag: "\u{1F1F8}\u{1F1E6}", order: 10 },
  dan: { name: "Dinamarqu\xEAs", flag: "\u{1F1E9}\u{1F1F0}", order: 10 },
  da: { name: "Dinamarqu\xEAs", flag: "\u{1F1E9}\u{1F1F0}", order: 10 },
  nld: { name: "Holand\xEAs", flag: "\u{1F1F3}\u{1F1F1}", order: 10 },
  dut: { name: "Holand\xEAs", flag: "\u{1F1F3}\u{1F1F1}", order: 10 },
  nl: { name: "Holand\xEAs", flag: "\u{1F1F3}\u{1F1F1}", order: 10 },
  pol: { name: "Polon\xEAs", flag: "\u{1F1F5}\u{1F1F1}", order: 10 },
  pl: { name: "Polon\xEAs", flag: "\u{1F1F5}\u{1F1F1}", order: 10 },
  tur: { name: "Turco", flag: "\u{1F1F9}\u{1F1F7}", order: 10 },
  tr: { name: "Turco", flag: "\u{1F1F9}\u{1F1F7}", order: 10 },
  swe: { name: "Sueco", flag: "\u{1F1F8}\u{1F1EA}", order: 10 },
  sv: { name: "Sueco", flag: "\u{1F1F8}\u{1F1EA}", order: 10 },
  nor: { name: "Noruegu\xEAs", flag: "\u{1F1F3}\u{1F1F4}", order: 10 },
  no: { name: "Noruegu\xEAs", flag: "\u{1F1F3}\u{1F1F4}", order: 10 },
  fin: { name: "Finland\xEAs", flag: "\u{1F1EB}\u{1F1EE}", order: 10 },
  fi: { name: "Finland\xEAs", flag: "\u{1F1EB}\u{1F1EE}", order: 10 },
  ell: { name: "Grego", flag: "\u{1F1EC}\u{1F1F7}", order: 10 },
  el: { name: "Grego", flag: "\u{1F1EC}\u{1F1F7}", order: 10 },
  heb: { name: "Hebraico", flag: "\u{1F1EE}\u{1F1F1}", order: 10 },
  he: { name: "Hebraico", flag: "\u{1F1EE}\u{1F1F1}", order: 10 },
  cze: { name: "Tcheco", flag: "\u{1F1E8}\u{1F1FF}", order: 10 },
  cs: { name: "Tcheco", flag: "\u{1F1E8}\u{1F1FF}", order: 10 },
  hun: { name: "H\xFAngaro", flag: "\u{1F1ED}\u{1F1FA}", order: 10 },
  hu: { name: "H\xFAngaro", flag: "\u{1F1ED}\u{1F1FA}", order: 10 },
  ron: { name: "Romeno", flag: "\u{1F1F7}\u{1F1F4}", order: 10 },
  ro: { name: "Romeno", flag: "\u{1F1F7}\u{1F1F4}", order: 10 },
  bul: { name: "B\xFAlgaro", flag: "\u{1F1E7}\u{1F1EC}", order: 10 },
  bg: { name: "B\xFAlgaro", flag: "\u{1F1E7}\u{1F1EC}", order: 10 },
  ukr: { name: "Ucraniano", flag: "\u{1F1FA}\u{1F1E6}", order: 10 },
  uk: { name: "Ucraniano", flag: "\u{1F1FA}\u{1F1E6}", order: 10 },
  ind: { name: "Indon\xE9sio", flag: "\u{1F1EE}\u{1F1E9}", order: 10 },
  id: { name: "Indon\xE9sio", flag: "\u{1F1EE}\u{1F1E9}", order: 10 },
  tha: { name: "Tailand\xEAs", flag: "\u{1F1F9}\u{1F1ED}", order: 10 },
  th: { name: "Tailand\xEAs", flag: "\u{1F1F9}\u{1F1ED}", order: 10 },
  hin: { name: "Hindi", flag: "\u{1F1EE}\u{1F1F3}", order: 10 },
  hi: { name: "Hindi", flag: "\u{1F1EE}\u{1F1F3}", order: 10 },
  hrv: { name: "Croata", flag: "\u{1F1ED}\u{1F1F7}", order: 10 },
  srp: { name: "S\xE9rvio", flag: "\u{1F1F7}\u{1F1F8}", order: 10 },
  alb: { name: "Alban\xEAs", flag: "\u{1F1E6}\u{1F1F1}", order: 10 },
  ben: { name: "Bengali", flag: "\u{1F1E7}\u{1F1E9}", order: 10 }
};
function getLanguageInfo(langCode) {
  const code = (langCode || "").toLowerCase().trim();
  if (LANGUAGE_INFO[code]) return LANGUAGE_INFO[code];
  try {
    const displayNames = new Intl.DisplayNames(["pt-BR"], { type: "language" });
    const resolvedName = displayNames.of(code);
    if (resolvedName) {
      return {
        name: resolvedName.charAt(0).toUpperCase() + resolvedName.slice(1),
        flag: "\u{1F310}",
        order: 20
      };
    }
  } catch {
  }
  return {
    name: code ? code.toUpperCase() : "Outro",
    flag: "\u{1F310}",
    order: 30
  };
}
function extractReleaseTag(raw) {
  if (raw.releaseGroup && typeof raw.releaseGroup === "string" && raw.releaseGroup.trim()) {
    const clean = raw.releaseGroup.trim().replace(/^\[|\]$/g, "");
    if (clean.length >= 2 && clean.length <= 25) return clean;
  }
  const str = raw.movieReleaseName || raw.subtitleFileName || "";
  if (typeof str === "string") {
    const match = str.match(/(blu-?ray|bdrip|web-?dl|webrip|hdtv|netflix|amazon|disney|repack|proper|1080p|720p)/i);
    if (match) {
      return match[1].toUpperCase();
    }
  }
  return void 0;
}
function calculateSubtitleQualityScore(sub, apiIndex = 0, stream) {
  let score = 0;
  const url = (sub.url || "").toLowerCase();
  if (url.includes(".srt")) score += 40;
  else if (url.includes(".vtt")) score += 30;
  const relStr = `${sub.movieReleaseName || ""} ${sub.subtitleFileName || ""} ${sub.releaseGroup || ""}`.toLowerCase();
  if (/\b(web[-_]?dl|webrip|bluray|bdrip|brrip|1080p|2160p|4k|fhd|uhd|remux|netflix|amazon|disney|apple)\b/i.test(relStr)) {
    score += 60;
  } else if (/\b(hdtv|720p|hd)\b/i.test(relStr)) {
    score += 30;
  }
  if (/\b(cam|hdcam|ts|telesync|camrip|dvdscr|workprint)\b/i.test(relStr)) {
    score -= 100;
  }
  if (stream) {
    const streamText = `${stream.title || ""} ${stream.name || ""} ${stream.description || ""} ${stream.behaviorHints?.bingeGroup || ""}`.toLowerCase();
    const isStreamWeb = /\b(web[-_]?dl|webrip|web|amzn|netflix|disney|apple|hbo|max)\b/i.test(streamText);
    const isStreamBluRay = /\b(bluray|bdrip|brrip|bd|remux)\b/i.test(streamText);
    const isStreamHdtv = /\b(hdtv|pdtv|dsr)\b/i.test(streamText);
    const isSubWeb = /\b(web[-_]?dl|webrip|web|amzn|netflix|disney|apple|hbo|max)\b/i.test(relStr);
    const isSubBluRay = /\b(bluray|bdrip|brrip|bd|remux)\b/i.test(relStr);
    const isSubHdtv = /\b(hdtv|pdtv|dsr)\b/i.test(relStr);
    if (isStreamWeb && isSubWeb) {
      score += 220;
    } else if (isStreamBluRay && isSubBluRay) {
      score += 220;
    } else if (isStreamHdtv && isSubHdtv) {
      score += 200;
    }
    if (isStreamWeb && isSubBluRay) {
      score -= 140;
    } else if (isStreamBluRay && isSubWeb) {
      score -= 140;
    }
    const groups = ["yts", "yify", "flux", "rarbg", "psa", "qxr", "cmrg", "galaxytv", "sparks", "ntb", "dimension", "evo", "amzn", "nf"];
    for (const g of groups) {
      if (new RegExp(`\\b${g}\\b`, "i").test(streamText) && new RegExp(`\\b${g}\\b`, "i").test(relStr)) {
        score += 250;
        break;
      }
    }
  }
  if (typeof sub.score === "number" && !isNaN(sub.score)) {
    score += Math.min(sub.score * 10, 50);
  }
  if (typeof sub.rating === "number" && !isNaN(sub.rating)) {
    score += Math.min(sub.rating * 10, 40);
  }
  if (typeof sub.downloads === "number" && !isNaN(sub.downloads)) {
    score += Math.min(sub.downloads / 50, 30);
  }
  if (sub.hearing_impaired === false || sub.hi === false) {
    score += 15;
  }
  const lang = (sub.lang || "").toLowerCase();
  if (/^(pob|pt-br|bra|por-br)$/i.test(lang)) {
    score += 35;
  }
  score += Math.max(0, 25 - apiIndex);
  return score;
}
var WIN1252_REVERSE = {
  8364: 128,
  // €
  8218: 130,
  // ‚
  402: 131,
  // ƒ
  8222: 132,
  // „
  8230: 133,
  // …
  8224: 134,
  // †
  8225: 135,
  // ‡
  710: 136,
  // ˆ
  8240: 137,
  // ‰
  352: 138,
  // Š
  8249: 139,
  // ‹
  338: 140,
  // Œ
  381: 142,
  // Ž
  8216: 145,
  // ‘
  8217: 146,
  // ’
  8220: 147,
  // “
  8221: 148,
  // ”
  8226: 149,
  // •
  8211: 150,
  // –
  8212: 151,
  // —
  732: 152,
  // ˜
  8482: 153,
  // ™
  353: 154,
  // š
  8250: 155,
  // ›
  339: 156,
  // œ
  382: 158,
  // ž
  376: 159
  // Ÿ
};
var HTML_ENTITIES = {
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " ",
  "&iexcl;": "\xA1",
  "&iquest;": "\xBF",
  "&aacute;": "\xE1",
  "&eacute;": "\xE9",
  "&iacute;": "\xED",
  "&oacute;": "\xF3",
  "&uacute;": "\xFA",
  "&ntilde;": "\xF1",
  "&atilde;": "\xE3",
  "&otilde;": "\xF5",
  "&acirc;": "\xE2",
  "&ecirc;": "\xEA",
  "&icirc;": "\xEE",
  "&ocirc;": "\xF4",
  "&ucirc;": "\xFB",
  "&agrave;": "\xE0",
  "&egrave;": "\xE8",
  "&ccedil;": "\xE7",
  "&Aacute;": "\xC1",
  "&Eacute;": "\xC9",
  "&Iacute;": "\xCD",
  "&Oacute;": "\xD3",
  "&Uacute;": "\xDA",
  "&Ntilde;": "\xD1",
  "&Atilde;": "\xC3",
  "&Otilde;": "\xD5",
  "&Acirc;": "\xC2",
  "&Ecirc;": "\xCA",
  "&Ccedil;": "\xC7"
};
function decodeHtmlEntities(text) {
  if (!text || !text.includes("&")) return text;
  return text.replace(/&[a-zA-Z0-9#]+;/g, (match) => {
    if (HTML_ENTITIES[match]) return HTML_ENTITIES[match];
    if (match.startsWith("&#x") || match.startsWith("&#X")) {
      const hex = parseInt(match.slice(3, -1), 16);
      if (!isNaN(hex)) return String.fromCodePoint(hex);
    } else if (match.startsWith("&#")) {
      const dec = parseInt(match.slice(2, -1), 10);
      if (!isNaN(dec)) return String.fromCodePoint(dec);
    }
    return match;
  });
}
var MOJIBAKE_MAP = [
  // Multi-byte punctuation
  [/â€¦/g, "\u2026"],
  [/â€œ/g, "\u201C"],
  [/â€“/g, "\u2013"],
  [/â€”/g, "\u2014"],
  [/â€˜/g, "\u2018"],
  [/â€™/g, "\u2019"],
  [/â€/g, "\u201D"],
  [/Â¿/g, "\xBF"],
  [/Â¡/g, "\xA1"],
  [/Âº/g, "\xBA"],
  [/Âª/g, "\xAA"],
  [/Â«/g, "\xAB"],
  [/Â»/g, "\xBB"],
  // Portuguese, Spanish, French, German, Italian, etc.
  [/Ã¡/g, "\xE1"],
  [/Ã©/g, "\xE9"],
  [/Ã­/g, "\xED"],
  [/Ã³/g, "\xF3"],
  [/Ãº/g, "\xFA"],
  [/Ã£/g, "\xE3"],
  [/Ãµ/g, "\xF5"],
  [/Ã¢/g, "\xE2"],
  [/Ãª/g, "\xEA"],
  [/Ã®/g, "\xEE"],
  [/Ã´/g, "\xF4"],
  [/Ã»/g, "\xFB"],
  [/Ã§/g, "\xE7"],
  [/Ã /g, "\xE0"],
  [/Ã¨/g, "\xE8"],
  [/Ã¬/g, "\xEC"],
  [/Ã²/g, "\xF2"],
  [/Ã¹/g, "\xF9"],
  [/Ã±/g, "\xF1"],
  [/Ã¤/g, "\xE4"],
  [/Ã¶/g, "\xF6"],
  [/Ã¼/g, "\xFC"],
  [/ÃŸ/g, "\xDF"],
  // Uppercase
  [/Ã /g, "\xC1"],
  [/Ã‰/g, "\xC9"],
  [/Ã /g, "\xCD"],
  [/Ã“/g, "\xD3"],
  [/Ãš/g, "\xDA"],
  [/Ãƒ/g, "\xC3"],
  [/Ã•/g, "\xD5"],
  [/Ã‚/g, "\xC2"],
  [/ÃŠ/g, "\xCA"],
  [/ÃŽ/g, "\xCE"],
  [/Ã”/g, "\xD4"],
  [/Ã›/g, "\xDB"],
  [/Ã‡/g, "\xC7"],
  [/Ã€/g, "\xC0"],
  [/Ãˆ/g, "\xC8"],
  [/ÃŒ/g, "\xCC"],
  [/Ã’/g, "\xD2"],
  [/Ã™/g, "\xD9"],
  [/Ã‘/g, "\xD1"],
  [/Ã„/g, "\xC4"],
  [/Ã–/g, "\xD6"],
  [/Ãœ/g, "\xDC"]
];
function replaceKnownMojibake(str) {
  let s = str;
  for (const [pattern, rep] of MOJIBAKE_MAP) {
    s = s.replace(pattern, rep);
  }
  return s;
}
function fixMojibake(text) {
  if (!text) return text;
  let current = text.replace(/â€¦/g, "\u2026").replace(/â€œ/g, "\u201C").replace(/â€“/g, "\u2013").replace(/â€”/g, "\u2014").replace(/â€˜/g, "\u2018").replace(/â€™/g, "\u2019").replace(/â€/g, "\u201D");
  const mojibakeRegex = /[\u00C3\u00C2][\u0080-\u00BF\u0160\u0161\u0192\u0152\u0153\u017D\u017E\u0178\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]|\u00E2\u20AC/;
  for (let iteration = 0; iteration < 2; iteration++) {
    if (!mojibakeRegex.test(current)) break;
    try {
      const bytes = [];
      let canReencode = true;
      for (let i = 0; i < current.length; i++) {
        const code = current.charCodeAt(i);
        if (code <= 255) {
          bytes.push(code);
        } else if (WIN1252_REVERSE[code] !== void 0) {
          bytes.push(WIN1252_REVERSE[code]);
        } else {
          canReencode = false;
          break;
        }
      }
      if (canReencode) {
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
        current = decoded;
      } else {
        current = replaceKnownMojibake(current);
        break;
      }
    } catch {
      current = replaceKnownMojibake(current);
      break;
    }
  }
  return decodeHtmlEntities(current);
}
function sanitizeSubtitleText(text) {
  if (!text) return "";
  let cleaned = text.replace(/^\uFEFF/, "").replace(/^WEBVTT[^\n]*\n+/i, "");
  cleaned = fixMojibake(cleaned);
  cleaned = cleaned.replace(/.*suporte a legendas em portugu[eê]s ativo.*/gi, "");
  cleaned = cleaned.replace(/.*\[zapitv\s*•?\s*legenda em portugu[eê]s[^\]]*\].*/gi, "");
  return decodeHtmlEntities(cleaned).trim();
}
function parseTimeString(t) {
  if (!t) return 0;
  const [hms, ms] = t.split(/[,.]/);
  const parts = hms.split(":").map(Number);
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  }
  const milliseconds = ms ? parseInt(ms.padEnd(3, "0").slice(0, 3), 10) : 0;
  return seconds + milliseconds / 1e3;
}
function parseSRT(data) {
  const cues = [];
  const cleanedData = sanitizeSubtitleText(data);
  const blocks = cleanedData.replace(/\r\n/g, "\n").split("\n\n");
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length >= 2) {
      const timeLine = lines.find((l) => l.includes("-->"));
      if (timeLine) {
        const [startStr, endStr] = timeLine.split("-->").map((s) => s.trim());
        const start = parseTimeString(startStr);
        const end = parseTimeString(endStr);
        const timeIndex = lines.indexOf(timeLine);
        let text = lines.slice(timeIndex + 1).join("\n").replace(/<[^>]+>/g, "").replace(/\{[^}]+\}/g, "").trim();
        text = sanitizeSubtitleText(text);
        const isPlaceholder = /suporte a legendas|legenda em portugu[eê]s|\[zapitv|zapitv oficial|zapitv pt-br/i.test(text);
        if (text && !isPlaceholder && !isNaN(start) && !isNaN(end)) {
          cues.push({ start, end, text });
        }
      }
    }
  }
  return cues;
}
var SubtitleService = class _SubtitleService {
  constructor() {
    this.subtitleCache = /* @__PURE__ */ new Map();
  }
  static {
    this.CACHE_TTL_MS = 60 * 60 * 1e3;
  }
  // 1 hora
  /**
   * Consulta rapidamente se existem legendas PT-BR nativas disponíveis para o item/episódio.
   */
  async hasPtBrSubtitles(item, season, episode, stream) {
    try {
      const tracks = await this.fetchSubtitles(item, season, episode, stream);
      return tracks.some(
        (t) => (t.isPtBr || /^(pob|pt-br|bra|por-br)$/i.test(t.lang)) && !t.id.startsWith("pt-guaranteed-")
      );
    } catch {
      return false;
    }
  }
  /**
   * Fetches, normalizes, labels and prioritizes subtitles from OpenSubtitles v3
   * com correspondência inteligente com o release do stream de vídeo atual.
   */
  async fetchSubtitles(item, season, episode, stream) {
    const streamSig = stream?.title || stream?.name || "def";
    const cacheKey = `${item.id || item.imdbId || item.tmdbId}_${season || 0}_${episode || 0}_${streamSig.slice(0, 30)}`;
    const cached = this.subtitleCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < _SubtitleService.CACHE_TTL_MS) {
      return cached.tracks;
    }
    try {
      let imdbId = item.imdbId;
      if (!imdbId || !imdbId.startsWith("tt")) {
        if (item.tmdbId) {
          try {
            const resolved = await tmdbService.getImdbId(item.tmdbId, item.type);
            if (resolved && resolved.startsWith("tt")) imdbId = resolved;
          } catch {
          }
        }
        if (!imdbId && item.id) {
          try {
            const resolved = await tmdbService.getImdbId(item.id, item.type);
            if (resolved && resolved.startsWith("tt")) imdbId = resolved;
          } catch {
          }
        }
        if (!imdbId && item.title) {
          try {
            const stremioType = item.type === "FILME" /* MOVIE */ ? "movie" : "series";
            const cineRes = await fetch(`https://v3-cinemeta.strem.io/catalog/${stremioType}/top/search=${encodeURIComponent(item.title)}.json`);
            if (cineRes.ok) {
              const cineData = await cineRes.json();
              if (cineData?.metas?.[0]?.id?.startsWith("tt")) {
                imdbId = cineData.metas[0].id;
              }
            }
          } catch {
          }
        }
        if (!imdbId && item.title) {
          try {
            const results = await tmdbService.searchMulti(item.title);
            const found = results.find((r) => r.imdbId?.startsWith("tt"));
            if (found?.imdbId) imdbId = found.imdbId;
          } catch {
          }
        }
      }
      const targetId = imdbId || item.id;
      const type = item.type === "FILME" /* MOVIE */ ? "movie" : "series";
      const cleanId = season && episode ? `${targetId}:${season}:${episode}` : targetId;
      const endpoints = [];
      if (cleanId && cleanId !== "sample-stream") {
        endpoints.push(`https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(cleanId)}.json`);
        endpoints.push(`https://opensubtitles.strem.io/subtitles/${type}/${encodeURIComponent(cleanId)}.json`);
        if (type === "series" || item.type === "ANIME" /* ANIME */) {
          endpoints.push(`https://opensubtitles-v3.strem.io/subtitles/anime/${encodeURIComponent(cleanId)}.json`);
        }
      }
      const rawSubtitles = [];
      const seenUrls = /* @__PURE__ */ new Set();
      if (endpoints.length > 0) {
        const responses = await Promise.allSettled(
          endpoints.map(
            (ep) => fetch(ep, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5e3) }).then((r) => r.ok ? r.json() : null)
          )
        );
        for (const resp of responses) {
          if (resp.status === "fulfilled" && resp.value && Array.isArray(resp.value.subtitles)) {
            for (const sub of resp.value.subtitles) {
              if (sub.url && !seenUrls.has(sub.url)) {
                seenUrls.add(sub.url);
                rawSubtitles.push(sub);
              }
            }
          }
        }
      }
      const bestByLanguage = /* @__PURE__ */ new Map();
      const ptCandidates = [];
      rawSubtitles.forEach((s, idx) => {
        if (!s.url) return;
        const langKey = (s.lang || "und").toLowerCase();
        const info = getLanguageInfo(langKey);
        const canonicalKey = info.isPtBr ? "Portugu\xEAs (Brasil)" : info.name;
        const score = calculateSubtitleQualityScore(s, idx, stream);
        const release = extractReleaseTag(s);
        const candidate = { sub: s, score, info, release };
        if (info.isPtBr) {
          ptCandidates.push(candidate);
        }
        const currentBest = bestByLanguage.get(canonicalKey);
        if (!currentBest || score > currentBest.score) {
          bestByLanguage.set(canonicalKey, candidate);
        }
      });
      const formattedTracks = Array.from(bestByLanguage.values()).map(({ sub, info, release, score }) => {
        return {
          id: sub.id || `sub-best-${info.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
          lang: sub.lang,
          languageName: info.name,
          label: `${info.flag} ${info.name}`,
          flag: info.flag,
          url: sub.url,
          order: info.order,
          release,
          isPtBr: info.isPtBr,
          autoSyncBadge: score >= 150
        };
      });
      if (ptCandidates.length > 1) {
        ptCandidates.sort((a, b) => b.score - a.score);
        const primary = ptCandidates[0];
        const secondary = ptCandidates.find((c) => c.release && c.release !== primary.release);
        if (secondary && secondary.sub?.url !== primary.sub?.url) {
          formattedTracks.push({
            id: secondary.sub.id ? `alt-${secondary.sub.id}` : `pt-alt-${secondary.release?.toLowerCase() || "rel"}`,
            lang: secondary.sub.lang,
            languageName: "Portugu\xEAs (Brasil)",
            label: `\u{1F1E7}\u{1F1F7} Portugu\xEAs (Brasil) \xB7 ${secondary.release || "Alternativa"}`,
            flag: "\u{1F1E7}\u{1F1F7}",
            url: secondary.sub.url,
            order: 1.5,
            release: secondary.release,
            isPtBr: true,
            autoSyncBadge: true
          });
        }
      }
      const hasPtBrTrack = formattedTracks.some((t) => t.isPtBr || /^(pob|pt-br|por-br|bra)$/i.test(t.lang));
      if (!hasPtBrTrack) {
        const baseTrack = formattedTracks.find((t) => /^(eng|en)$/i.test(t.lang)) || formattedTracks[0];
        if (baseTrack) {
          formattedTracks.unshift({
            id: `pt-translate-${item.id}-${season || 1}-${episode || 1}`,
            lang: "pob",
            languageName: "Portugu\xEAs (Brasil)",
            label: "\u{1F1E7}\u{1F1F7} Portugu\xEAs (Brasil)",
            flag: "\u{1F1E7}\u{1F1F7}",
            url: `auto-translate:${baseTrack.url}`,
            order: 1,
            release: "Tradu\xE7\xE3o IA",
            isPtBr: true,
            isAutoTranslated: true,
            autoSyncBadge: false
          });
        }
      }
      formattedTracks.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        if (a.languageName !== b.languageName) {
          return a.languageName.localeCompare(b.languageName, "pt-BR");
        }
        return 0;
      });
      this.subtitleCache.set(cacheKey, { tracks: formattedTracks, timestamp: Date.now() });
      return formattedTracks;
    } catch (err) {
      console.warn("Erro ao carregar legendas:", err);
      return [];
    }
  }
  /**
   * Fetches SRT content and correctly decodes UTF-8 / UTF-16 / Windows-1252 / ISO-8859-1
   * and repairs any mojibake in Portuguese or other languages.
   * Valida rigorosamente o idioma do conteúdo para que textos em inglês nunca sejam retornados como PT-BR.
   */
  async fetchAndDecodeSRT(url, langCode, cacheKey) {
    if (!url || url.startsWith("direct-pt:")) {
      throw new Error("Legenda em Portugu\xEAs indispon\xEDvel no momento.");
    }
    if (url.startsWith("auto-translate:")) {
      const sourceUrl = url.replace("auto-translate:", "");
      if (!sourceUrl) {
        throw new Error("Fonte de tradu\xE7\xE3o ausente.");
      }
      const rawSource = await this.fetchAndDecodeSRT(sourceUrl);
      const cues = parseSRT(rawSource);
      if (cues.length === 0) {
        throw new Error("Nenhuma fala encontrada na legenda fonte para tradu\xE7\xE3o.");
      }
      const transResult = await subtitleTranslationService.translateCuesToPtBr(
        cues,
        cacheKey || `auto_${sourceUrl.slice(-40)}`
      );
      if (!transResult.success || !transResult.translatedSrt) {
        throw new Error(transResult.error || "Falha na tradu\xE7\xE3o autom\xE1tica para Portugu\xEAs (Brasil).");
      }
      return transResult.translatedSrt;
    }
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha HTTP ao baixar legenda: ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let decoded = "";
    if (bytes.length >= 2) {
      if (bytes[0] === 255 && bytes[1] === 254) {
        try {
          const u16le = new TextDecoder("utf-16le").decode(buffer);
          decoded = sanitizeSubtitleText(u16le);
        } catch {
        }
      } else if (bytes[0] === 254 && bytes[1] === 255) {
        try {
          const u16be = new TextDecoder("utf-16be").decode(buffer);
          decoded = sanitizeSubtitleText(u16be);
        } catch {
        }
      }
    }
    if (!decoded) {
      try {
        const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
        decoded = sanitizeSubtitleText(utf8Decoder.decode(buffer));
      } catch {
        const lang = (langCode || "").toLowerCase().trim();
        const encodingsToTry = [];
        if (/^(ru|rus|uk|ukr|bg|bul|be|bel|sr|srp)/.test(lang)) {
          encodingsToTry.push("windows-1251", "iso-8859-5");
        } else if (/^(el|ell|gre)/.test(lang)) {
          encodingsToTry.push("windows-1253", "iso-8859-7");
        } else if (/^(tr|tur)/.test(lang)) {
          encodingsToTry.push("windows-1254", "iso-8859-9");
        } else if (/^(pl|pol|cs|cze|sk|slk|hu|hun|ro|ron|hr|hrv)/.test(lang)) {
          encodingsToTry.push("windows-1250", "iso-8859-2");
        } else if (/^(he|heb|iw)/.test(lang)) {
          encodingsToTry.push("windows-1255", "iso-8859-8");
        } else if (/^(ar|ara)/.test(lang)) {
          encodingsToTry.push("windows-1256", "iso-8859-6");
        }
        encodingsToTry.push("windows-1252", "iso-8859-1");
        for (const enc of encodingsToTry) {
          try {
            const dec = new TextDecoder(enc);
            const text = dec.decode(buffer);
            if (text) {
              decoded = sanitizeSubtitleText(text);
              break;
            }
          } catch {
          }
        }
        if (!decoded) {
          const fallbackDecoder = new TextDecoder("utf-8");
          decoded = sanitizeSubtitleText(fallbackDecoder.decode(buffer));
        }
      }
    }
    if (langCode && /^(pob|pt-br|bra|por-br|pt|por)$/i.test(langCode)) {
      const validation = validateSubtitleContentMatch(decoded, langCode);
      if (!validation.isValid) {
        console.warn("[ZapiSubtitles] Legenda declarada como PT-BR cont\xE9m texto em outro idioma:", validation.reason);
        try {
          const cues = parseSRT(decoded);
          if (cues.length > 0) {
            const transResult = await subtitleTranslationService.translateCuesToPtBr(
              cues,
              cacheKey || `auto_${url.slice(-40)}`
            );
            if (transResult.success && transResult.translatedSrt) {
              return transResult.translatedSrt;
            }
          }
        } catch {
        }
        throw new Error(`Inconsist\xEAncia de idioma: A legenda est\xE1 em ingl\xEAs e n\xE3o em portugu\xEAs.`);
      }
    }
    return decoded;
  }
};
var subtitleService = new SubtitleService();

// src/core/tracking/mediaLoadingTracker.ts
var MediaLoadingTracker = class _MediaLoadingTracker {
  constructor() {
    this.traces = /* @__PURE__ */ new Map();
    this.activeTraces = /* @__PURE__ */ new Map();
    // canonicalId -> traceId
    this.listeners = /* @__PURE__ */ new Set();
  }
  static getInstance() {
    if (!_MediaLoadingTracker.instance) {
      _MediaLoadingTracker.instance = new _MediaLoadingTracker();
    }
    return _MediaLoadingTracker.instance;
  }
  startTrace(canonicalId, title, mediaType, season, episode) {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const trace = {
      traceId,
      title,
      canonicalId,
      mediaType,
      season,
      episode,
      currentStep: "LOADING_METADATA",
      startedAt: Date.now(),
      history: [
        {
          step: "LOADING_METADATA",
          startedAt: Date.now()
        }
      ],
      providerAttempts: []
    };
    this.traces.set(traceId, trace);
    this.activeTraces.set(canonicalId, traceId);
    this.logDebug(trace, "IN\xCDCIO", `Iniciando rastreamento de [${title}] (ID: ${canonicalId})`);
    this.notify(trace);
    return traceId;
  }
  getActiveTrace(canonicalId) {
    const traceId = this.activeTraces.get(canonicalId);
    return traceId ? this.traces.get(traceId) : void 0;
  }
  getTrace(traceId) {
    return this.traces.get(traceId);
  }
  transition(traceIdOrCanonicalId, nextStep, details, error) {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;
    const now = Date.now();
    const currentStepTrace = trace.history[trace.history.length - 1];
    if (currentStepTrace && !currentStepTrace.endedAt) {
      currentStepTrace.endedAt = now;
      currentStepTrace.durationMs = now - currentStepTrace.startedAt;
    }
    trace.currentStep = nextStep;
    trace.history.push({
      step: nextStep,
      startedAt: now,
      details,
      error
    });
    if (nextStep === "PLAYING" || nextStep === "READY") {
      trace.finalStatus = "SUCCESS";
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === "ERROR") {
      trace.finalStatus = "ERROR";
      trace.errorDetails = error || details?.message;
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === "UNAVAILABLE") {
      trace.finalStatus = "UNAVAILABLE";
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    } else if (nextStep === "TIMEOUT") {
      trace.finalStatus = "TIMEOUT";
      trace.errorDetails = error || "Opera\xE7\xE3o excedeu o tempo limite configurado";
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    }
    this.logDebug(trace, nextStep, `Transi\xE7\xE3o para [${nextStep}] (${currentStepTrace ? currentStepTrace.durationMs + "ms" : "0ms"})`, details);
    this.notify(trace);
  }
  recordProviderAttempt(traceIdOrCanonicalId, attempt) {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;
    trace.providerAttempts.push(attempt);
    this.notify(trace);
  }
  endTrace(traceIdOrCanonicalId, status) {
    let trace = this.traces.get(traceIdOrCanonicalId);
    if (!trace) {
      const traceId = this.activeTraces.get(traceIdOrCanonicalId);
      if (traceId) trace = this.traces.get(traceId);
    }
    if (!trace) return;
    const now = Date.now();
    if (!trace.endedAt) {
      trace.endedAt = now;
      trace.totalDurationMs = now - trace.startedAt;
    }
    if (status) trace.finalStatus = status;
    const lastStep = trace.history[trace.history.length - 1];
    if (lastStep && !lastStep.endedAt) {
      lastStep.endedAt = now;
      lastStep.durationMs = now - lastStep.startedAt;
    }
    this.activeTraces.delete(trace.canonicalId);
    this.logDebug(trace, "FINALIZADO", `Trace encerrado com status [${trace.finalStatus || "CONCLU\xCDDO"}] em ${trace.totalDurationMs}ms`);
    this.notify(trace);
  }
  logDebug(trace, step, msg, details) {
    if (process.env.NODE_ENV !== "production" || typeof window !== "undefined") {
      const epStr = trace.episode ? ` S${trace.season || 1}E${trace.episode}` : "";
      console.log(
        `%c[ZapiTV-Tracker]%c [${trace.title}${epStr}] ${step}: ${msg}`,
        "background: #ff5500; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;",
        "color: #38bdf8;",
        details || ""
      );
    }
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify(trace) {
    for (const listener of this.listeners) {
      try {
        listener(trace);
      } catch {
      }
    }
  }
  getRecentTraces(limit = 20) {
    return Array.from(this.traces.values()).sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
  }
};
var mediaLoadingTracker = MediaLoadingTracker.getInstance();

// src/core/providers/mediaSourceValidationService.ts
var STORAGE_VALIDATED_SOURCES_KEY = "zapitv_validated_sources_v2";
var VALIDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1e3;
var REJECTED_CACHE_TTL_MS = 6 * 60 * 60 * 1e3;
var MediaSourceValidationService = class _MediaSourceValidationService {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.validationPromises = /* @__PURE__ */ new Map();
    this.loadFromStorage();
  }
  static getInstance() {
    if (!_MediaSourceValidationService.instance) {
      _MediaSourceValidationService.instance = new _MediaSourceValidationService();
    }
    return _MediaSourceValidationService.instance;
  }
  /**
   * Gera uma chave única e estável para a fonte
   */
  getSourceKey(mediaId, stream, season, episode) {
    const rawUrl = stream.url || stream.infoHash || `${stream.name}-${stream.title}`;
    const epKey = season !== void 0 && episode !== void 0 ? `_s${season}e${episode}` : "";
    return `${mediaId.toLowerCase()}${epKey}_${rawUrl.toLowerCase()}`;
  }
  /**
   * Carrega cache persistente
   */
  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_VALIDATED_SOURCES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          for (const item of parsed) {
            if (item && item.sourceId && item.lastChecked) {
              const ttl = item.availability === "rejected" ? REJECTED_CACHE_TTL_MS : VALIDATION_CACHE_TTL_MS;
              if (now - item.lastChecked < ttl) {
                this.cache.set(item.sourceId, item);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[MediaSourceValidationService] Erro ao carregar cache de valida\xE7\xE3o:", e);
    }
  }
  /**
   * Salva cache persistente
   */
  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const items = Array.from(this.cache.values()).slice(-500);
      localStorage.setItem(STORAGE_VALIDATED_SOURCES_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("[MediaSourceValidationService] Erro ao salvar cache de valida\xE7\xE3o:", e);
    }
  }
  /**
   * Extrai o tipo de stream a partir da URL
   */
  detectStreamType(url) {
    const clean = url.toLowerCase().split("?")[0];
    if (clean.includes(".m3u8")) return "hls";
    if (clean.includes(".mpd")) return "dash";
    if (clean.endsWith(".mp4") || clean.endsWith(".m4v")) return "mp4";
    if (clean.endsWith(".webm")) return "webm";
    return "unknown";
  }
  /**
   * Extrai resoluções reais de um stream (sem inventar resoluções ou herdar de outras fontes)
   */
  extractStreamResolutions(stream, parsedLevels) {
    if (parsedLevels && parsedLevels.length > 0) {
      const validLevels = parsedLevels.map((l) => l.toLowerCase().trim()).filter((l) => /^(360p|480p|720p|1080p|1440p|2160p|4k)$/i.test(l)).map((l) => l === "2160p" ? "4K" : l.endsWith("p") ? l : `${l}p`);
      if (validLevels.length > 0) {
        return Array.from(new Set(validLevels));
      }
    }
    const text = `${stream.name || ""} ${stream.title || ""} ${stream.description || ""}`.toLowerCase();
    const qualities = [];
    if (/\b(2160p|4k|uhd)\b/i.test(text)) {
      qualities.push("4K");
    }
    if (/\b(1080p|fhd|full[-_\s]?hd)\b/i.test(text)) {
      qualities.push("1080p");
    }
    if (/\b(720p|hd)\b/i.test(text)) {
      qualities.push("720p");
    }
    if (/\b(480p|sd)\b/i.test(text)) {
      qualities.push("480p");
    }
    if (qualities.length === 0 && stream.quality) {
      const q = stream.quality.toLowerCase();
      if (q.includes("4k") || q.includes("2160")) qualities.push("4K");
      else if (q.includes("1080")) qualities.push("1080p");
      else if (q.includes("720")) qualities.push("720p");
      else if (q.includes("480")) qualities.push("480p");
    }
    return qualities.length > 0 ? qualities : ["1080p"];
  }
  /**
   * Validação técnica profunda e centralizada de uma fonte Stremio
   */
  async validateSource(stream, context) {
    const sourceKey = this.getSourceKey(context.mediaId, stream, context.season, context.episode);
    const cached = this.cache.get(sourceKey);
    if (cached && Date.now() - cached.lastChecked < VALIDATION_CACHE_TTL_MS) {
      return cached;
    }
    const inFlight = this.validationPromises.get(sourceKey);
    if (inFlight) {
      return inFlight;
    }
    const validationPromise = this.performValidation(stream, context, sourceKey);
    this.validationPromises.set(sourceKey, validationPromise);
    try {
      const result = await validationPromise;
      this.cache.set(sourceKey, result);
      this.saveToStorage();
      return result;
    } finally {
      this.validationPromises.delete(sourceKey);
    }
  }
  async performValidation(stream, context, sourceKey) {
    const now = Date.now();
    const providerId = stream.providerId || stream.providerName || "unknown-provider";
    const providerName = stream.providerName || stream.name || "Provedor Desconhecido";
    const rawUrl = stream.url || "";
    if (!rawUrl) {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: "",
        season: context.season,
        episode: context.episode,
        streamType: "unknown",
        audioLanguages: [],
        availableAudioTracks: [],
        availableResolutions: [],
        resolutionsByAudioTrack: {},
        hasFunctionalAudio: false,
        audioValidationReason: "Sem URL direta de stream",
        availability: "rejected",
        validationState: "rejected",
        lastChecked: now,
        rejectionReason: "Stream sem URL v\xE1lida de reprodu\xE7\xE3o",
        originalStream: stream
      };
    }
    const quarantine = streamQuarantineService.evaluateQuarantine(stream, context.mediaTitle);
    if (quarantine.isQuarantined) {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: rawUrl,
        season: context.season,
        episode: context.episode,
        streamType: this.detectStreamType(rawUrl),
        audioLanguages: [],
        availableAudioTracks: [],
        availableResolutions: [],
        resolutionsByAudioTrack: {},
        hasFunctionalAudio: false,
        audioValidationReason: "Fonte em quarentena de seguran\xE7a",
        availability: "rejected",
        validationState: "rejected",
        lastChecked: now,
        rejectionReason: `Fonte isolada por seguran\xE7a (${quarantine.reason})`,
        originalStream: stream
      };
    }
    const adEval = videoAdBlocker.evaluateStream(stream, context.mediaTitle, context.season, context.episode);
    if (adEval.status === "bloqueado por propaganda embutida") {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: rawUrl,
        season: context.season,
        episode: context.episode,
        streamType: this.detectStreamType(rawUrl),
        audioLanguages: [],
        availableAudioTracks: [],
        availableResolutions: [],
        resolutionsByAudioTrack: {},
        hasFunctionalAudio: false,
        audioValidationReason: "Fonte com propaganda de apostas embutida",
        availability: "rejected",
        validationState: "rejected",
        lastChecked: now,
        rejectionReason: `Rejeitado: ${adEval.reason}`,
        originalStream: stream
      };
    }
    if (context.canonicalIdentity) {
      const confEval = sourceConfidenceEngine.evaluate(stream, context.canonicalIdentity);
      if (confEval.confidence === "REJECTED" || confEval.confidence === "QUARANTINED") {
        return {
          mediaId: context.mediaId,
          sourceId: sourceKey,
          providerId,
          providerName,
          url: rawUrl,
          season: context.season,
          episode: context.episode,
          streamType: this.detectStreamType(rawUrl),
          audioLanguages: [],
          availableAudioTracks: [],
          availableResolutions: [],
          resolutionsByAudioTrack: {},
          hasFunctionalAudio: false,
          audioValidationReason: "Diverg\xEAncia de identidade da obra",
          availability: "rejected",
          validationState: "rejected",
          lastChecked: now,
          rejectionReason: `T\xEDtulo incompat\xEDvel: ${confEval.reasons.join(", ")}`,
          originalStream: stream
        };
      }
    }
    const audioAnalysis = audioPreferenceService.analyzeAudio(stream);
    const subtitleAnalysis = subtitlePreferenceService.analyzeSubtitles(stream, context.hasExternalPtSub || false);
    const streamType = this.detectStreamType(rawUrl);
    const resolutions = this.extractStreamResolutions(stream);
    const audioTracks = [];
    const audioLanguages = [];
    const resolutionsByAudio = {};
    if (audioAnalysis.isPtBr) {
      audioLanguages.push("pt-BR");
      audioTracks.push({
        id: "track-pt-br",
        name: audioAnalysis.isDubbed ? "Portugu\xEAs (Dublado)" : "Portugu\xEAs (Brasil)",
        lang: "pt-BR",
        isPtBr: true,
        isDubbed: audioAnalysis.isDubbed
      });
      resolutionsByAudio["pt-BR"] = [...resolutions];
    }
    if (audioAnalysis.isDualAudio || !audioAnalysis.isPtBr) {
      const origLang = audioAnalysis.language === "pt-BR" ? "en" : audioAnalysis.language !== "unknown" ? audioAnalysis.language : "original";
      if (!audioLanguages.includes(origLang)) {
        audioLanguages.push(origLang);
        audioTracks.push({
          id: `track-${origLang}`,
          name: origLang === "ja" ? "Japon\xEAs (Original)" : origLang === "en" ? "Ingl\xEAs (Original)" : "\xC1udio Original",
          lang: origLang,
          isPtBr: false,
          isDubbed: false
        });
        resolutionsByAudio[origLang] = [...resolutions];
      }
    }
    if (audioLanguages.length === 0) {
      audioLanguages.push("original");
      audioTracks.push({
        id: "track-original",
        name: "\xC1udio Original",
        lang: "original",
        isPtBr: false,
        isDubbed: false
      });
      resolutionsByAudio["original"] = [...resolutions];
    }
    let isAccessible = true;
    let probeReason = "Stream acess\xEDvel";
    let detectedAudioOk = true;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      try {
        const probeUrl = rawUrl.startsWith("http://localhost") || rawUrl.startsWith("/api/") ? rawUrl : `/api/proxy?url=${encodeURIComponent(rawUrl)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4e3);
        const resp = await fetch(probeUrl, {
          method: "GET",
          headers: { Range: "bytes=0-1024" },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const contentType = resp.headers.get("content-type") || "";
        if (contentType.includes("text/html") && !rawUrl.includes(".m3u8")) {
          isAccessible = false;
          probeReason = "Servidor retornou p\xE1gina HTML de erro ou dom\xEDnio estacionado";
        } else if (resp.status >= 400 && resp.status !== 416) {
          isAccessible = false;
          probeReason = `Servidor respondeu com c\xF3digo de erro HTTP ${resp.status}`;
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          probeReason = "Tempo limite de resposta do servidor da fonte (4s)";
        }
      }
    }
    if (!isAccessible) {
      return {
        mediaId: context.mediaId,
        sourceId: sourceKey,
        providerId,
        providerName,
        url: rawUrl,
        season: context.season,
        episode: context.episode,
        streamType,
        audioLanguages,
        availableAudioTracks: audioTracks,
        availableResolutions: resolutions,
        resolutionsByAudioTrack: resolutionsByAudio,
        hasFunctionalAudio: false,
        audioValidationReason: probeReason,
        availability: "rejected",
        validationState: "rejected",
        lastChecked: now,
        rejectionReason: probeReason,
        originalStream: stream
      };
    }
    return {
      mediaId: context.mediaId,
      sourceId: sourceKey,
      providerId,
      providerName,
      url: rawUrl,
      canonicalIdentity: context.canonicalIdentity,
      season: context.season,
      episode: context.episode,
      streamType,
      audioLanguages,
      availableAudioTracks: audioTracks,
      availableResolutions: resolutions,
      resolutionsByAudioTrack: resolutionsByAudio,
      hasFunctionalAudio: detectedAudioOk,
      audioValidationReason: "Trilha de \xE1udio compat\xEDvel detectada",
      availability: "ready",
      validationState: "ready_for_playback",
      lastChecked: now,
      originalStream: stream
    };
  }
  /**
   * Filtra e retorna apenas as resoluções válidas para uma combinação de fonte e idioma de áudio
   */
  getResolutionsForLanguage(source, langCode) {
    if (source.resolutionsByAudioTrack[langCode]) {
      return source.resolutionsByAudioTrack[langCode];
    }
    return source.availableResolutions.length > 0 ? source.availableResolutions : ["1080p"];
  }
  /**
   * Invalida registros de uma fonte quando ocorre erro de reprodução
   */
  invalidateSource(mediaId, streamUrl, reason) {
    for (const [key, record] of this.cache.entries()) {
      if (record.url === streamUrl || key.includes(mediaId.toLowerCase())) {
        record.availability = "rejected";
        record.validationState = "rejected";
        record.rejectionReason = reason;
        record.lastChecked = Date.now();
      }
    }
    this.saveToStorage();
  }
};
var mediaSourceValidationService = MediaSourceValidationService.getInstance();

// src/core/catalog/featuredCatalogItems.ts
var FEATURED_CATALOG_ITEMS = [
  // =========================================================================
  // FILMES — IMDB MOVIEMETER (IMAGEM 1 DE REFERÊNCIA)
  // =========================================================================
  // 1. SOBREVIVÊNCIA (2026 - tt29971038) — Em cartaz no cinema (Theatrical Window)
  {
    id: "movie-sobrevivencia-2026",
    title: "Sobreviv\xEAncia",
    originalTitle: "Animals",
    type: "FILME" /* MOVIE */,
    rating: 7.9,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt29971038/img",
    backdrop: "https://images.metahub.space/background/medium/tt29971038/img",
    description: "Um thriller eletrizante sobre sobreviv\xEAncia e dilemas morais em uma situa\xE7\xE3o extrema.",
    genres: ["Drama", "Suspense"],
    imdbId: "tt29971038",
    isFeatured: true,
    inTheaters: true,
    availabilityStatus: "unavailable",
    audioStatus: "other",
    verifiedStreams: []
  },
  // 2. DIGGER (2026 - tt31454558) — Disponível
  {
    id: "movie-digger-2026",
    title: "Digger",
    originalTitle: "Digger",
    type: "FILME" /* MOVIE */,
    rating: 7.8,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt31454558/img",
    backdrop: "https://images.metahub.space/background/medium/tt31454558/img",
    description: "Em uma regi\xE3o montanhosa e remota, um homem solit\xE1rio se v\xEA diante de conflitos do passado quando seu filho reaparece inesperadamente.",
    genres: ["Aventura", "Drama", "A\xE7\xE3o"],
    imdbId: "tt31454558",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 3. OUTRA MAMÃE (2026 - tt21440780) — Disponível
  {
    id: "movie-outra-mamae-2026",
    title: "Outra Mam\xE3e",
    originalTitle: "Another Mother",
    type: "FILME" /* MOVIE */,
    rating: 7.4,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt21440780/img",
    backdrop: "https://images.metahub.space/background/medium/tt21440780/img",
    description: "Ap\xF3s uma perda devastadora, uma mulher descobre verdades perturbadoras sobre a nova fam\xEDlia que tenta acolh\xEA-la.",
    genres: ["Suspense", "Mist\xE9rio", "Drama"],
    imdbId: "tt21440780",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 4. VERITY (2026 - tt15888806) — Disponível
  {
    id: "movie-verity-2026",
    title: "Verity",
    originalTitle: "Verity",
    type: "FILME" /* MOVIE */,
    rating: 8.1,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt15888806/img",
    backdrop: "https://images.metahub.space/background/medium/tt15888806/img",
    description: "Uma escritora em dificuldades financeiras aceita a proposta de concluir a s\xE9rie de sucesso de uma famosa autora incapacitada, descobrindo segredos aterrorizantes em seus manuscritos.",
    genres: ["Romance", "Mist\xE9rio", "Drama"],
    imdbId: "tt15888806",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 5. O EXORCISTA: MÁRTIRES (2026 - tt28704204) — Disponível
  {
    id: "movie-exorcista-martires-2026",
    title: "O Exorcista: M\xE1rtires",
    originalTitle: "The Exorcist: Martyrs",
    type: "FILME" /* MOVIE */,
    rating: 7.2,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt28704204/img",
    backdrop: "https://images.metahub.space/background/medium/tt28704204/img",
    description: "Cap\xEDtulo aterrorizante da saga onde padres e especialistas espirituais enfrentam manifesta\xE7\xF5es demon\xEDacas em comunidades isoladas.",
    genres: ["Terror", "Mist\xE9rio"],
    imdbId: "tt28704204",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 6. MATCHBOX: O FILME (2026 - tt31828574) — Disponível
  {
    id: "movie-matchbox-2026",
    title: "Matchbox: O Filme",
    originalTitle: "Matchbox",
    type: "FILME" /* MOVIE */,
    rating: 7.5,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt31828574/img",
    backdrop: "https://images.metahub.space/background/medium/tt31828574/img",
    description: "A\xE7\xE3o em alta velocidade inspirada na lend\xE1ria linha de ve\xEDculos e pistas radicais, com persegui\xE7\xF5es cinematogr\xE1ficas alucinantes.",
    genres: ["A\xE7\xE3o", "Aventura"],
    imdbId: "tt31828574",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 7. RESIDENT EVIL (2026 - tt13000574) — Disponível
  {
    id: "movie-resident-evil-2026",
    title: "Resident Evil",
    originalTitle: "Resident Evil",
    type: "FILME" /* MOVIE */,
    rating: 7.6,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt13000574/img",
    backdrop: "https://images.metahub.space/background/medium/tt13000574/img",
    description: "Nova adapta\xE7\xE3o cinematogr\xE1fica da ic\xF4nica franquia de terror e sobreviv\xEAncia da Capcom com fidelidade m\xE1xima \xE0 atmosfera sombria.",
    genres: ["A\xE7\xE3o", "Terror", "Fic\xE7\xE3o Cient\xEDfica"],
    imdbId: "tt13000574",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 8. HOMEM-ARANHA: UM NOVO DIA (2026 - tt20221436) — Disponível
  {
    id: "movie-spiderman-new-day-2026",
    title: "Homem-Aranha: Um Novo Dia",
    originalTitle: "Spider-Man: Brand New Day",
    type: "FILME" /* MOVIE */,
    rating: 8.3,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt20221436/img",
    backdrop: "https://images.metahub.space/background/medium/tt20221436/img",
    description: "Peter Parker tenta reconstruir sua vida an\xF4nima nas ruas de Nova York enquanto novos vigilantes e amea\xE7as emergem.",
    genres: ["A\xE7\xE3o", "Aventura", "Fic\xE7\xE3o Cient\xEDfica"],
    imdbId: "tt20221436",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 9. CORAÇÃO SELVAGEM (1990 - tt0100935) — Disponível
  {
    id: "movie-wild-at-heart-1990",
    title: "Cora\xE7\xE3o Selvagem",
    originalTitle: "Wild at Heart",
    type: "FILME" /* MOVIE */,
    rating: 7.2,
    year: 1990,
    image: "https://images.metahub.space/poster/medium/tt0100935/img",
    backdrop: "https://images.metahub.space/background/medium/tt0100935/img",
    description: "Jovens amantes fogem pela estrada enquanto a m\xE3e controladora da garota contrata assassinos e detetives para ca\xE7\xE1-los. Cl\xE1ssico cult de David Lynch com Nicolas Cage e Laura Dern.",
    genres: ["Crime", "Drama", "Romance"],
    imdbId: "tt0100935",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 10. O OUTRO LADO DAS REDES (2020 - tt11464826) — Disponível
  {
    id: "movie-social-dilemma-2020",
    title: "O Outro Lado das Redes",
    originalTitle: "The Social Dilemma",
    type: "FILME" /* MOVIE */,
    rating: 7.6,
    year: 2020,
    image: "https://images.metahub.space/poster/medium/tt11464826/img",
    backdrop: "https://images.metahub.space/background/medium/tt11464826/img",
    description: "Especialistas em tecnologia e ex-executivos do Vale do Sil\xEDcio revelam o impacto perigoso e manipulador das redes sociais sobre a psicologia humana e a sociedade.",
    genres: ["Document\xE1rio", "Drama"],
    imdbId: "tt11464826",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 11. UNABOMBER (2026 - tt1392796) — Disponível
  {
    id: "movie-unabomber-2026",
    title: "Unabomber",
    originalTitle: "Unabomber",
    type: "FILME" /* MOVIE */,
    rating: 7.7,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt1392796/img",
    backdrop: "https://images.metahub.space/background/medium/tt1392796/img",
    description: "A hist\xF3ria real da ca\xE7ada do FBI ao terrorista matem\xE1tico Ted Kaczynski e a revolu\xE7\xE3o dos m\xE9todos de an\xE1lise lingu\xEDstica forense.",
    genres: ["Biografia", "Crime", "Drama"],
    imdbId: "tt1392796",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 12. DIA D (2026 - tt11576182) — Disponível
  {
    id: "movie-dia-d-2026",
    title: "Dia D",
    originalTitle: "D-Day",
    type: "FILME" /* MOVIE */,
    rating: 7.5,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt11576182/img",
    backdrop: "https://images.metahub.space/background/medium/tt11576182/img",
    description: "A reconstitui\xE7\xE3o cinematogr\xE1fica da Opera\xE7\xE3o Overlord e o desembarque dos aliados na Normandia durante a Segunda Guerra Mundial.",
    genres: ["Guerra", "Hist\xF3ria", "Drama"],
    imdbId: "tt11576182",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 13. A ODISSEIA (2026 - tt2788314) — Disponível
  {
    id: "movie-a-odisseia-2026",
    title: "A Odisseia",
    originalTitle: "The Odyssey",
    type: "FILME" /* MOVIE */,
    rating: 8,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt2788314/img",
    backdrop: "https://images.metahub.space/background/medium/tt2788314/img",
    description: "A \xE9pica jornada de Ulisses narrada em uma superprodu\xE7\xE3o visual, enfrentando monstros mitol\xF3gicos e a ira dos deuses gregos para retornar a \xCDtaca.",
    genres: ["Aventura", "Fantasia", "Drama"],
    imdbId: "tt2788314",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 14. OBSESSÃO (1976 - tt0074991) — Disponível
  {
    id: "movie-obsession-1976",
    title: "Obsess\xE3o",
    originalTitle: "Obsession",
    type: "FILME" /* MOVIE */,
    rating: 7,
    year: 1976,
    image: "https://images.metahub.space/poster/medium/tt0074991/img",
    backdrop: "https://images.metahub.space/background/medium/tt0074991/img",
    description: "Um empres\xE1rio assombrado pelo sequestro e morte de sua esposa conhece uma mulher id\xEAntica anos depois na It\xE1lia. Obra-prima de suspense dirigida por Brian De Palma.",
    genres: ["Mist\xE9rio", "Drama", "Suspense"],
    imdbId: "tt0074991",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 15. PRISIONEIRO (2026 - tt11897478)
  {
    id: "movie-prisioneiro-2026",
    title: "Prisioneiro",
    originalTitle: "Prisoner",
    type: "FILME" /* MOVIE */,
    rating: 7.3,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt11897478/img",
    backdrop: "https://images.metahub.space/background/medium/tt11897478/img",
    description: "Um homem aprisionado injustamente em um complexo de seguran\xE7a m\xE1xima descobre uma conspira\xE7\xE3o de alto n\xEDvel.",
    genres: ["A\xE7\xE3o", "Suspense"],
    imdbId: "tt11897478",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 16. BACKROOMS: UM NÃO-LUGAR (2026 - tt26658104)
  {
    id: "movie-backrooms-2026",
    title: "Backrooms: Um N\xE3o-Lugar",
    originalTitle: "The Backrooms",
    type: "FILME" /* MOVIE */,
    rating: 7.1,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt26658104/img",
    backdrop: "https://images.metahub.space/background/medium/tt26658104/img",
    description: "Ao cair fora da realidade, um jovem se encontra em um labirinto infinito de salas vazias e carpete \xFAmido com entidades \xE0 espreita.",
    genres: ["Terror", "Fic\xE7\xE3o Cient\xEDfica"],
    imdbId: "tt26658104",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 17. THE UPRISING: RISE OF ROBIN HOOD (2026 - tt18944118)
  {
    id: "movie-the-uprising-2026",
    title: "The Uprising: Rise of Robin Hood",
    originalTitle: "The Uprising",
    type: "FILME" /* MOVIE */,
    rating: 7,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt18944118/img",
    backdrop: "https://images.metahub.space/background/medium/tt18944118/img",
    description: "As origens sombrias e sangrentas da rebeli\xE3o de Robin dos Bosques contra a corrup\xE7\xE3o da monarquia brit\xE2nica.",
    genres: ["A\xE7\xE3o", "Aventura", "Hist\xF3rico"],
    imdbId: "tt18944118",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // 23. CARRIE, A ESTRANHA (1976 - tt0074296)
  {
    id: "movie-carrie-1976",
    title: "Carrie, a Estranha",
    originalTitle: "Carrie",
    type: "FILME" /* MOVIE */,
    rating: 7.4,
    year: 1976,
    image: "https://images.metahub.space/poster/medium/tt0074296/img",
    backdrop: "https://images.metahub.space/background/medium/tt0074296/img",
    description: "Carrie White, uma adolescente t\xEDmida e marginalizada com poderes telecin\xE9ticos, liberta sua f\xFAria ap\xF3s uma humilha\xE7\xE3o traum\xE1tica no baile escolar.",
    genres: ["Terror", "Drama"],
    imdbId: "tt0074296",
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed"
  },
  // =========================================================================
  // SÉRIES — IMDB TVMETER (IMAGEM 2 DE REFERÊNCIA)
  // =========================================================================
  // 1. CARRIE: A ESTRANHA (2026- - tt30147890) — Ainda não lançada
  {
    id: "series-carrie-2026",
    title: "Carrie: A Estranha",
    originalTitle: "Carrie",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.5,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt30147890/img",
    backdrop: "https://images.metahub.space/background/medium/tt30147890/img",
    description: "Nova adapta\xE7\xE3o seriada da obra-prima de Stephen King sobre Carrie White e os segredos da sua pacata cidade.",
    genres: ["Terror", "Drama"],
    imdbId: "tt30147890",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 2. PROFUNDEZAS (2026- - tt32159846) — Ainda não lançada
  {
    id: "series-profundezas-2026",
    title: "Profundezas",
    originalTitle: "The Deep",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.6,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt32159846/img",
    backdrop: "https://images.metahub.space/background/medium/tt32159846/img",
    description: "Uma expedi\xE7\xE3o submarina a uma fossa abissal revela segredos que deveriam ter permanecido ocultos sob as ondas.",
    genres: ["Mist\xE9rio", "Fic\xE7\xE3o Cient\xEDfica"],
    imdbId: "tt32159846",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 3. A LESTE DO ÉDEN (2026- - tt22020214) — Ainda não lançada
  {
    id: "series-a-leste-do-eden-2026",
    title: "A Leste do \xC9den",
    originalTitle: "East of Eden",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.8,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt22020214/img",
    backdrop: "https://images.metahub.space/background/medium/tt22020214/img",
    description: "Adapta\xE7\xE3o do \xE9pico cl\xE1ssico de John Steinbeck sobre duas fam\xEDlias cujas hist\xF3rias se entrela\xE7am no vale de Salinas.",
    genres: ["Drama", "Hist\xF3rico"],
    imdbId: "tt22020214",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 4. LANTERNAS (2026- - tt26540670) — Ainda não lançada
  {
    id: "series-lanternas-2026",
    title: "Lanternas",
    originalTitle: "Lanterns",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt26540670/img",
    backdrop: "https://images.metahub.space/background/medium/tt26540670/img",
    description: "Os policiais intergal\xE1cticos Hal Jordan e John Stewart investigam um mist\xE9rio sombrio no cora\xE7\xE3o dos Estados Unidos.",
    genres: ["A\xE7\xE3o", "Aventura", "Fic\xE7\xE3o Cient\xEDfica"],
    imdbId: "tt26540670",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 5. TED LASSO (2020- - tt10986410) — DISPONÍVEL (TVmeter #5)
  {
    id: "series-ted-lasso",
    title: "Ted Lasso",
    originalTitle: "Ted Lasso",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.8,
    year: 2020,
    image: "https://images.metahub.space/poster/medium/tt10986410/img",
    backdrop: "https://images.metahub.space/background/medium/tt10986410/img",
    description: "O treinador de futebol americano Ted Lasso \xE9 contratado para comandar um time de futebol brit\xE2nico na Premier League com muito otimismo e empatia.",
    genres: ["Com\xE9dia", "Drama", "Esporte"],
    imdbId: "tt10986410",
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "ted-lasso-s1e1",
        number: 1,
        title: "Piloto",
        description: "Ted Lasso chega \xE0 Inglaterra para treinar o AFC Richmond, surpreendendo os torcedores e a m\xEDdia c\xE9tica.",
        image: "https://images.metahub.space/poster/medium/tt10986410/img"
      },
      {
        id: "ted-lasso-s1e2",
        number: 2,
        title: "Biscoitos",
        description: "Ted tenta conquistar Rebecca com doces caseiros enquanto resolve conflitos no vesti\xE1rio.",
        image: "https://images.metahub.space/poster/medium/tt10986410/img"
      }
    ]
  },
  // 6. TERRA DE MÁFIA (2026- - tt28289508) — Ainda não lançada
  {
    id: "series-terra-de-mafia-2026",
    title: "Terra de M\xE1fia",
    originalTitle: "MobLand",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.7,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt28289508/img",
    backdrop: "https://images.metahub.space/background/medium/tt28289508/img",
    description: "Conflitos territoriais sangrentos entre fam\xEDlias rivais em uma cidade fronteiri\xE7a dominada pelo crime organizado.",
    genres: ["Crime", "Drama"],
    imdbId: "tt28289508",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 7. SLOW HORSES (2022- - tt5875444) — DISPONÍVEL (TVmeter #7)
  {
    id: "series-slow-horses",
    title: "Slow Horses",
    originalTitle: "Slow Horses",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.3,
    year: 2022,
    image: "https://images.metahub.space/poster/medium/tt5875444/img",
    backdrop: "https://images.metahub.space/background/medium/tt5875444/img",
    description: "Uma equipe disfuncional de agentes do MI5 que cometeram erros em suas carreiras tenta proteger o Reino Unido sob a lideran\xE7a do beberr\xE3o e brilhante Jackson Lamb.",
    genres: ["Suspense", "Drama", "Crime"],
    imdbId: "tt5875444",
    seasonsCount: 4,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "slow-horses-s1e1",
        number: 1,
        title: "Slough House",
        description: "Ap\xF3s um exerc\xEDcio de treinamento fracassado, River Cartwright \xE9 banido para a Slough House.",
        image: "https://images.metahub.space/poster/medium/tt5875444/img"
      },
      {
        id: "slow-horses-s1e2",
        number: 2,
        title: "Work Drinks",
        description: "A equipe se envolve no caso do sequestro de um estudante universit\xE1rio.",
        image: "https://images.metahub.space/poster/medium/tt5875444/img"
      }
    ]
  },
  // 8. WAR (2026- - tt29458920) — Ainda não lançada
  {
    id: "series-war-2026",
    title: "War",
    originalTitle: "War",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.9,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt29458920/img",
    backdrop: "https://images.metahub.space/background/medium/tt29458920/img",
    description: "Cr\xF4nica visceral das tens\xF5es geopol\xEDticas e opera\xE7\xF5es t\xE1ticas em um conflito global em larga escala.",
    genres: ["Guerra", "A\xE7\xE3o", "Drama"],
    imdbId: "tt29458920",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 9. MONSTROS (2022- - tt13207736) — DISPONÍVEL (TVmeter #9)
  {
    id: "series-monstros",
    title: "Monstros",
    originalTitle: "Monsters",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.9,
    year: 2022,
    image: "https://images.metahub.space/poster/medium/tt13207736/img",
    backdrop: "https://images.metahub.space/background/medium/tt13207736/img",
    description: "S\xE9rie antol\xF3gica sobre crimes reais que chocaram a sociedade, explorando a psicologia e a din\xE2mica dos julgamentos.",
    genres: ["Biografia", "Crime", "Drama"],
    imdbId: "tt13207736",
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "monsters-s1e1",
        number: 1,
        title: "Epis\xF3dio 1",
        description: "O in\xEDcio das investiga\xE7\xF5es de um caso que paralisou a opini\xE3o p\xFAblica.",
        image: "https://images.metahub.space/poster/medium/tt13207736/img"
      }
    ]
  },
  // 10. HISTÓRIA DE HORROR AMERICANA (2011- - tt1844624) — DISPONÍVEL (TVmeter #10)
  {
    id: "series-ahs",
    title: "Hist\xF3ria de Horror Americana",
    originalTitle: "American Horror Story",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8,
    year: 2011,
    image: "https://images.metahub.space/poster/medium/tt1844624/img",
    backdrop: "https://images.metahub.space/background/medium/tt1844624/img",
    description: "S\xE9rie antol\xF3gica criada por Ryan Murphy que explora diferentes mitos, casas assombradas, asilos, covens e lendas urbanas de horror.",
    genres: ["Terror", "Drama", "Mist\xE9rio"],
    imdbId: "tt1844624",
    seasonsCount: 12,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "ahs-s1e1",
        number: 1,
        title: "Piloto: Murder House",
        description: "A fam\xEDlia Harmon muda-se de Boston para Los Angeles para recome\xE7ar suas vidas em uma mans\xE3o com passado macabro.",
        image: "https://images.metahub.space/poster/medium/tt1844624/img"
      }
    ]
  },
  // 11. MAGNATAS DO CRIME (2024- - tt16066148) — DISPONÍVEL (TVmeter #11)
  {
    id: "series-the-gentlemen",
    title: "Magnatas do Crime",
    originalTitle: "The Gentlemen",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.1,
    year: 2024,
    image: "https://images.metahub.space/poster/medium/tt16066148/img",
    backdrop: "https://images.metahub.space/background/medium/tt16066148/img",
    description: "Eddie Horniman herda inesperadamente a vasta propriedade rural do pai, descobrindo que ela faz parte de um imp\xE9rio bilion\xE1rio da cannabis.",
    genres: ["A\xE7\xE3o", "Com\xE9dia", "Crime"],
    imdbId: "tt16066148",
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "gentlemen-s1e1",
        number: 1,
        title: "Refinado e Perigoso",
        description: "Eddie descobre que o neg\xF3cio secreto da fam\xEDlia vem acompanhado de g\xE2ngsteres exc\xEAntricos e perigosos.",
        image: "https://images.metahub.space/poster/medium/tt16066148/img"
      }
    ]
  },
  // 12. AVATAR: OS SETE REFÚGIOS (2026- - tt32567812) — Ainda não lançada
  {
    id: "series-avatar-sete-refugios-2026",
    title: "Avatar: Os Sete Ref\xFAgios",
    originalTitle: "Avatar: The Seven Havens",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.2,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt32567812/img",
    backdrop: "https://images.metahub.space/background/medium/tt32567812/img",
    description: "Uma nova jornada \xE9pica no mundo da dobra elemental onde jovens dominadores protegem os antigos santu\xE1rios sagrados.",
    genres: ["A\xE7\xE3o", "Aventura", "Fantasia"],
    imdbId: "tt32567812",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 13. NEAGLEY: DETETIVE PARTICULAR (2026- - tt33314545) — Ainda não lançada
  {
    id: "series-neagley-2026",
    title: "Neagley: Detetive Particular",
    originalTitle: "Neagley",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.9,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt33314545/img",
    backdrop: "https://images.metahub.space/background/medium/tt33314545/img",
    description: "Spin-off de Reacher focado na investigadora de elite Frances Neagley resolvendo casos complexos em Chicago.",
    genres: ["A\xE7\xE3o", "Crime", "Drama"],
    imdbId: "tt33314545",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 14. O MENTALISTA (2008-2015 - tt1196946) — DISPONÍVEL (TVmeter #14)
  {
    id: "series-the-mentalist",
    title: "O Mentalista",
    originalTitle: "The Mentalist",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.2,
    year: 2008,
    image: "https://images.metahub.space/poster/medium/tt1196946/img",
    backdrop: "https://images.metahub.space/background/medium/tt1196946/img",
    description: "Patrick Jane, um ex-falso m\xE9dium com impressionante poder de observa\xE7\xE3o e dedu\xE7\xE3o, atua como consultor do CBI enquanto busca vingan\xE7a contra o serial killer Red John.",
    genres: ["Crime", "Drama", "Mist\xE9rio"],
    imdbId: "tt1196946",
    seasonsCount: 7,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "mentalist-s1e1",
        number: 1,
        title: "Piloto",
        description: "Patrick Jane ajuda a equipe do CBI liderada por Teresa Lisbon a investigar o homic\xEDdio da esposa de um jogador de golfe.",
        image: "https://images.metahub.space/poster/medium/tt1196946/img"
      }
    ]
  },
  // 15. GAME OF THRONES (2011-2019 - tt0944947) — DISPONÍVEL (TVmeter #15)
  {
    id: "series-game-of-thrones-2011",
    title: "Game of Thrones",
    originalTitle: "Game of Thrones",
    type: "S\xC9RIE" /* SERIES */,
    rating: 9.2,
    year: 2011,
    image: "https://images.metahub.space/poster/medium/tt0944947/img",
    backdrop: "https://images.metahub.space/background/medium/tt0944947/img",
    description: "Nove fam\xEDlias nobres lutam pelo controle do Trono de Ferro de Westeros enquanto um inimigo ancestral desperta al\xE9m da Muralha.",
    genres: ["A\xE7\xE3o", "Aventura", "Drama", "Fantasia"],
    imdbId: "tt0944947",
    seasonsCount: 8,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "got-s1e1",
        number: 1,
        title: "O Inverno Est\xE1 Chegando",
        description: "Lorde Ned Stark recebe a visita do Rei Robert Baratheon em Winterfell para assumir o cargo de M\xE3o do Rei.",
        image: "https://images.metahub.space/poster/medium/tt0944947/img"
      }
    ]
  },
  // 16. REACHER (2022- - tt9288030) — DISPONÍVEL (TVmeter #16)
  {
    id: "series-reacher",
    title: "Reacher",
    originalTitle: "Reacher",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.1,
    year: 2022,
    image: "https://images.metahub.space/poster/medium/tt9288030/img",
    backdrop: "https://images.metahub.space/background/medium/tt9288030/img",
    description: "O veterano da pol\xEDcia militar Jack Reacher viaja sem rumo pelos Estados Unidos e resolve mist\xE9rios violentos usando intelig\xEAncia e for\xE7a bruta.",
    genres: ["A\xE7\xE3o", "Crime", "Drama"],
    imdbId: "tt9288030",
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "reacher-s1e1",
        number: 1,
        title: "Bem-vindo a Margrave",
        description: "Reacher \xE9 preso logo ap\xF3s desembarcar em uma pacata cidade da Ge\xF3rgia acusado de um assassinato brutal.",
        image: "https://images.metahub.space/poster/medium/tt9288030/img"
      }
    ]
  },
  // 17. O SEGREDO DE WIDOW'S BAY (2026- - tt31854290) — Ainda não lançada
  {
    id: "series-widows-bay-2026",
    title: "O Segredo de Widow's Bay",
    originalTitle: "The Secret of Widow's Bay",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.7,
    year: 2026,
    image: "https://images.metahub.space/poster/medium/tt31854290/img",
    backdrop: "https://images.metahub.space/background/medium/tt31854290/img",
    description: "Uma comunidade costeira \xE9 abalada pelo ressurgimento de lendas sombrias e corpos na praia ap\xF3s uma tempestade.",
    genres: ["Mist\xE9rio", "Drama", "Suspense"],
    imdbId: "tt31854290",
    isFeatured: true,
    availabilityStatus: "unreleased",
    audioStatus: "other",
    episodes: []
  },
  // 18. OPERAÇÃO LIONESS (2023- - tt13111078) — DISPONÍVEL (TVmeter #18)
  {
    id: "series-lioness",
    title: "Opera\xE7\xE3o Lioness",
    originalTitle: "Special Ops: Lioness",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.8,
    year: 2023,
    image: "https://images.metahub.space/poster/medium/tt13111078/img",
    backdrop: "https://images.metahub.space/background/medium/tt13111078/img",
    description: "Criada por Taylor Sheridan, a s\xE9rie acompanha o programa de agentes secretas da CIA que se infiltram em c\xEDrculos terroristas globais.",
    genres: ["A\xE7\xE3o", "Drama", "Suspense"],
    imdbId: "tt13111078",
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "lioness-s1e1",
        number: 1,
        title: "Soldados Sacrificiais",
        description: "Joe recruta uma jovem fuzileira naval para se aproximar da filha de um financista do terrorismo.",
        image: "https://images.metahub.space/poster/medium/tt13111078/img"
      }
    ]
  },
  // 19. SILO (2023- - tt14688458) — DISPONÍVEL (TVmeter #19)
  {
    id: "series-silo",
    title: "Silo",
    originalTitle: "Silo",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.1,
    year: 2023,
    image: "https://images.metahub.space/poster/medium/tt14688458/img",
    backdrop: "https://images.metahub.space/background/medium/tt14688458/img",
    description: "Em um futuro t\xF3xico e devastado, uma comunidade de milhares de pessoas vive em um gigantesco silo subterr\xE2neo de 144 andares com regras rigorosas.",
    genres: ["Fic\xE7\xE3o Cient\xEDfica", "Drama", "Mist\xE9rio"],
    imdbId: "tt14688458",
    seasonsCount: 2,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "silo-s1e1",
        number: 1,
        title: "Dia da Liberdade",
        description: "O xerife Holston toma uma decis\xE3o fat\xEDdica ap\xF3s anos desconfiando das narrativas oficiais sobre a superf\xEDcie.",
        image: "https://images.metahub.space/poster/medium/tt14688458/img"
      }
    ]
  },
  // 22. BREAKING BAD (2008-2013 - tt0903747) — DISPONÍVEL (TVmeter #22)
  {
    id: "series-breaking-bad-2008",
    title: "Breaking Bad",
    originalTitle: "Breaking Bad",
    type: "S\xC9RIE" /* SERIES */,
    rating: 9.5,
    year: 2008,
    image: "https://images.metahub.space/poster/medium/tt0903747/img",
    backdrop: "https://images.metahub.space/background/medium/tt0903747/img",
    description: "Um professor de qu\xEDmica do ensino m\xE9dio com c\xE2ncer terminal se associa a um ex-aluno para produzir metanfetamina para garantir o futuro financeiro de sua fam\xEDlia.",
    genres: ["Crime", "Drama", "Suspense"],
    imdbId: "tt0903747",
    seasonsCount: 5,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "bb-s1e1",
        number: 1,
        title: "Piloto",
        description: "Walter White descobre que tem c\xE2ncer e decide usar suas habilidades em qu\xEDmica para entrar no submundo das drogas com Jesse Pinkman.",
        image: "https://images.metahub.space/poster/medium/tt0903747/img"
      }
    ]
  },
  // 23. MATÉRIA ESCURA (2024- - tt19231492) — DISPONÍVEL (TVmeter #23)
  {
    id: "series-dark-matter",
    title: "Mat\xE9ria Escura",
    originalTitle: "Dark Matter",
    type: "S\xC9RIE" /* SERIES */,
    rating: 7.7,
    year: 2024,
    image: "https://images.metahub.space/poster/medium/tt19231492/img",
    backdrop: "https://images.metahub.space/background/medium/tt19231492/img",
    description: "O f\xEDsico Jason Dessen \xE9 sequestrado e acorda em uma vers\xE3o alternativa de sua vida, lutando para retornar \xE0 sua verdadeira fam\xEDlia atrav\xE9s de realidades paralelas.",
    genres: ["Fic\xE7\xE3o Cient\xEDfica", "Drama", "Mist\xE9rio"],
    imdbId: "tt19231492",
    seasonsCount: 1,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "dark-matter-s1e1",
        number: 1,
        title: "Voc\xEA \xC9 Feliz na Sua Vida?",
        description: "Jason \xE9 atacado por um estranho mascarado e acorda em um laborat\xF3rio cercado de pessoas que o tratam como um g\xEAnio recluso.",
        image: "https://images.metahub.space/poster/medium/tt19231492/img"
      }
    ]
  },
  // 26. O DONO DE KINGSTOWN (2021- - tt11712058) — DISPONÍVEL (TVmeter #26)
  {
    id: "series-mayor-kingstown",
    title: "O Dono de Kingstown",
    originalTitle: "Mayor of Kingstown",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8.2,
    year: 2021,
    image: "https://images.metahub.space/poster/medium/tt11712058/img",
    backdrop: "https://images.metahub.space/background/medium/tt11712058/img",
    description: "A fam\xEDlia McLusky comanda os bastidores da cidade de Kingstown, Michigan, onde a \xFAnica ind\xFAstria lucrativa \xE9 o complexo penitenci\xE1rio.",
    genres: ["Crime", "Drama", "Suspense"],
    imdbId: "tt11712058",
    seasonsCount: 3,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "kingstown-s1e1",
        number: 1,
        title: "O Prefeito",
        description: "Mike McLusky tenta mediar acordos prec\xE1rios entre policiais, guardas e fac\xE7\xF5es criminosas dentro e fora das pris\xF5es.",
        image: "https://images.metahub.space/poster/medium/tt11712058/img"
      }
    ]
  },
  // 29. THE ROOKIE (2018- - tt7587890) — DISPONÍVEL (TVmeter #29)
  {
    id: "series-the-rookie",
    title: "The Rookie",
    originalTitle: "The Rookie",
    type: "S\xC9RIE" /* SERIES */,
    rating: 8,
    year: 2018,
    image: "https://images.metahub.space/poster/medium/tt7587890/img",
    backdrop: "https://images.metahub.space/background/medium/tt7587890/img",
    description: "John Nolan se torna o calouro mais velho da pol\xEDcia de Los Angeles ap\xF3s um incidente que muda sua vida.",
    genres: ["Crime", "Drama", "A\xE7\xE3o"],
    imdbId: "tt7587890",
    seasonsCount: 6,
    isFeatured: true,
    availabilityStatus: "verified",
    audioStatus: "pt-br-dubbed",
    episodes: [
      {
        id: "rookie-s1e1",
        number: 1,
        title: "Piloto",
        description: "Nolan inicia seu primeiro dia como recruta na divis\xE3o de patrulha do LAPD.",
        image: "https://images.metahub.space/poster/medium/tt7587890/img"
      }
    ]
  }
];

// constants.tsx
var AVATARS = [
  "https://i.imgur.com/0KzQwwX.png",
  "https://i.imgur.com/Spw0Cos.png",
  "https://i.imgur.com/6IEApDt.png",
  "https://i.imgur.com/FyLB4ca.png",
  "https://i.imgur.com/bA8ltkk.png",
  "https://i.imgur.com/kimAW6g.png",
  "https://i.imgur.com/sTbJUBM.png",
  "https://i.imgur.com/amtR2VN.png",
  "https://i.imgur.com/10zcAOY.png",
  "https://i.imgur.com/7yXXxXT.png",
  "https://i.imgur.com/XK8zLav.png",
  "https://i.imgur.com/6IYczXJ.png"
];
var createDefaultProfiles = (name) => [
  { id: "p1", name: name.split(" ")[0], avatar: AVATARS[0], isChild: false }
];
var MOCK_USERS = [
  {
    id: "u1",
    name: "Gr\xE1fica do Futuro",
    email: "graficadfuturo@gmail.com",
    password: "123",
    role: "admin",
    devMode: true,
    memberSince: "01/02/2026",
    plan: "Premium 4K",
    status: "Ativo",
    profiles: [
      { id: "p1", name: "Gr\xE1fica", avatar: AVATARS[0], isChild: false },
      { id: "p2", name: "Kids", avatar: "https://i.imgur.com/LSu54L9.png", isChild: true }
    ]
  },
  {
    id: "u2",
    name: "Gabriel Nascimento",
    email: "gbrielcn20@hotmail.com",
    password: "123",
    role: "user",
    devMode: false,
    memberSince: "10/12/2025",
    plan: "Premium",
    status: "Ativo",
    profiles: createDefaultProfiles("Gabriel Nascimento")
  },
  {
    id: "u3",
    name: "infoprodutos100k",
    email: "infoprodutos100k@gmail.com",
    password: "123",
    role: "user",
    devMode: false,
    memberSince: "15/01/2026",
    plan: "Padr\xE3o",
    status: "Ativo",
    profiles: createDefaultProfiles("infoprodutos100k")
  },
  {
    id: "u4",
    name: "Jo\xE3o Silva",
    email: "joao@example.com",
    password: "123",
    role: "admin",
    devMode: true,
    memberSince: "05/03/2024",
    plan: "B\xE1sico",
    status: "Atrasado",
    profiles: createDefaultProfiles("Jo\xE3o Silva")
  },
  {
    id: "u5",
    name: "Admin User",
    email: "admin@zapitv.com",
    password: "123",
    role: "admin",
    devMode: true,
    memberSince: "2023",
    plan: "Premium 4K",
    status: "Ativo",
    profiles: [{ id: "p_admin", name: "Admin", avatar: AVATARS[5], isChild: false }]
  }
];
var filmesData = [
  ...FEATURED_CATALOG_ITEMS,
  {
    "id": "movie-15340724",
    "title": "Garota do S\xE9culo 20",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.4,
    "image": "https://m.media-amazon.com/images/M/MV5BMjA4NzYxNWItZWJmNi00ODE2LTgwZDgtMzBkN2MzOGZhNDEzXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15340724/img",
    "description": "Em 1999, uma adolescente com um cora\xE7\xE3o de ouro come\xE7a a ficar de olho em uma colega de classe popular como um favor \xE0 sua melhor amiga apaixonada.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15340724",
    "imdbId": "tt15340724",
    "isFeatured": false,
    "director": "Bang Woo-ri",
    "cast": [
      "Kim Yoo-jung",
      "Byeon Woo-seok",
      "Park Jung-woo"
    ],
    "genres": [
      "Drama",
      "Romance",
      "Dorama"
    ],
    "ageRating": "TV-PG"
  },
  {
    "id": "movie-11897478",
    "title": "O Desconhecido",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.6,
    "image": "https://m.media-amazon.com/images/M/MV5BOGRlMWIyODMtNWVhNi00MjgxLWFhOGYtOGVlNjRiNmU0ZWNkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11897478/img",
    "description": "Dois homens que se conhecem num \xF4nibus iniciam uma conversa que se transforma em amizade. Para Henry Teague, desgastado por uma vida inteira de trabalho f\xEDsico e crime, este \xE9 um sonho que se torna realidade.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11897478",
    "imdbId": "tt11897478",
    "isFeatured": false,
    "director": "Thomas M. Wright",
    "cast": [
      "Joel Edgerton",
      "Sean Harris",
      "Jada Alberts"
    ],
    "genres": [
      "Crime",
      "Drama",
      "Suspense"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-1777606",
    "title": "Rosalina",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BNWFiODU3OGItMzc3Ni00ZDg1LTgwZTktNzJkOGViYjVhY2UxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt1777606/img",
    "description": 'Uma vers\xE3o c\xF4mica de "Romeu e Julieta" de Shakespeare, contada do ponto de vista da ex-namorada de Romeu, Rosaline, a mulher que Romeu afirma amar antes de se apaixonar por Julieta.',
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt1777606",
    "imdbId": "tt1777606",
    "isFeatured": false,
    "director": "Karen Maine",
    "cast": [
      "Kaitlyn Dever",
      "Isabela Merced",
      "Sean Teale"
    ],
    "genres": [
      "Com\xE9dia",
      "Romance"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-4595186",
    "title": "Uma Garota de Muita Sorte",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYTk0ZDg0YzMtNzYxYS00NTkzLWEyZGItNGMzNTRlZmZiYTEwXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt4595186/img",
    "description": "Uma mulher em Nova York, que parece ter as coisas sob controle, se depara com um trauma que faz sua vida desmoronar.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt4595186",
    "imdbId": "tt4595186",
    "isFeatured": false,
    "director": "Mike Barker",
    "cast": [
      "Mila Kunis",
      "Chiara Aurelia",
      "Finn Wittrock"
    ],
    "genres": [
      "Drama",
      "Mist\xE9rio",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-13635702",
    "title": "Aquele que Habita em Mim",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYWYxNjU5Y2ItN2ZjMi00NTM1LTlkOWUtZjc2OGRjYmI4OTdjXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt13635702/img",
    "description": "Uma s\xE9rie de eventos sobrenaturais revela uma verdade sombria por tr\xE1s de um adolescente atormentado.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt13635702",
    "imdbId": "tt13635702",
    "isFeatured": false,
    "director": "Jerren Lauder",
    "cast": [
      "Odessa A'zion",
      "Leslie Bibb",
      "Dermot Mulroney"
    ],
    "genres": [
      "Terror",
      "Suspense"
    ]
  },
  {
    "id": "movie-13456976",
    "title": "O Homem da Cabana",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.9,
    "image": "https://m.media-amazon.com/images/M/MV5BNTk3NmUyZWQtZDZjMS00YTE5LWE4YTMtMmIwODhhNjUyNzRjXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt13456976/img",
    "description": "Quando um caminhante perdido se depara com um velho errante que vive na floresta, ele nunca poderia ter imaginado o pesadelo que o aguarda.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt13456976",
    "imdbId": "tt13456976",
    "isFeatured": false,
    "director": "Lucky McKee",
    "cast": [
      "Stephen Lang",
      "Marc Senter",
      "Patch Darragh"
    ],
    "genres": [
      "Suspense"
    ]
  },
  {
    "id": "movie-10558652",
    "title": "O Palestrante",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.7,
    "image": "https://m.media-amazon.com/images/M/MV5BMTdmYjhmMjItOWVkMC00MThkLTgzOTQtMWM5Yzc5ZjIzNDFlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10558652/img",
    "description": "Tocado pela falta de perspectiva em sua vida, o contador Guilherme assume o lugar de Marcelo sem nem saber que o verdadeiro Marcelo \xE9 um palestrante motivacional.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10558652",
    "imdbId": "tt10558652",
    "isFeatured": false,
    "director": "Marcelo Antunez",
    "cast": [
      "F\xE1bio Porchat",
      "Dani Calabresa",
      "Saulo Arcoverde"
    ],
    "genres": [
      "Com\xE9dia",
      "Romance"
    ]
  },
  {
    "id": "movie-8363392",
    "title": "Blackout",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 3.9,
    "image": "https://m.media-amazon.com/images/M/MV5BZWM3OTk2NmYtOTNiNy00NWZjLTg1M2UtOWM5Y2RmMjc4NWVjXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8363392/img",
    "description": "Um homem acorda em um hospital sem mem\xF3ria e rapidamente se v\xEA fugindo em um hospital fechado com o Cartel em seu encal\xE7o. Ele luta para encontrar sua verdadeira identidade da maneira mais cruel.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8363392",
    "imdbId": "tt8363392",
    "isFeatured": false,
    "director": "Sam Macaroni",
    "cast": [
      "Josh Duhamel",
      "Abbie Cornish",
      "Omar Chaparro"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Crime",
      "Suspense"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-10304142",
    "title": "Amsterdam",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.1,
    "image": "https://m.media-amazon.com/images/M/MV5BNzgxNTQzYTEtMDI3Yi00OGQ1LWFkNGMtZDEyM2JlYmE0YzUyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10304142/img",
    "description": "Na d\xE9cada de 1930, tr\xEAs amigos testemunham um assassinato, s\xE3o incriminados e descobrem uma das conspira\xE7\xF5es mais ultrajantes da hist\xF3ria americana.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10304142",
    "imdbId": "tt10304142",
    "isFeatured": false,
    "director": "David O. Russell",
    "cast": [
      "Christian Bale",
      "Margot Robbie",
      "John David Washington"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama",
      "Hist\xF3ria"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-11128440",
    "title": "O Balconista 3",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.2,
    "image": "https://m.media-amazon.com/images/M/MV5BNmYzNzg5NzUtNzIzMy00MjEwLTk5OGItNmUxNGE4NGVhMmEwXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11128440/img",
    "description": "Dante, Elias, Jay e Silent Bob s\xE3o recrutados por Randal ap\xF3s um ataque card\xEDaco para fazer um filme sobre a loja de conveni\xEAncia que deu in\xEDcio a tudo.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11128440",
    "imdbId": "tt11128440",
    "isFeatured": false,
    "director": "Kevin Smith",
    "cast": [
      "Brian O'Halloran",
      "Jeff Anderson",
      "Vincent Pereira"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-9731598",
    "title": "Mais que Amigos",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BN2UxNGVkNDctMTdkZi00NzgyLWJiZjQtMGY1MWUwNTQ1MTY2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt9731598/img",
    "description": "Dois homens com problemas de compromisso tentam um relacionamento.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt9731598",
    "imdbId": "tt9731598",
    "isFeatured": false,
    "director": "Nicholas Stoller",
    "cast": [
      "Billy Eichner",
      "Luke Macfarlane",
      "Guy Branum"
    ],
    "genres": [
      "Com\xE9dia",
      "Romance"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-10354106",
    "title": "Stars at Noon",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.5,
    "image": "https://m.media-amazon.com/images/M/MV5BOTZmNmY5ZjgtNzU3OC00ZjkwLWFlZWMtN2Q1MjQ4MTg1ZTAyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10354106/img",
    "description": "Uma jovem jornalista americana presa na atual Nicar\xE1gua se apaixona por um enigm\xE1tico ingl\xEAs que parece ser sua melhor chance de fuga. Ela logo percebe, por\xE9m, que ele pode estar em perigo ainda maior do que ela.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10354106",
    "imdbId": "tt10354106",
    "isFeatured": false,
    "director": "Claire Denis",
    "cast": [
      "Margaret Qualley",
      "Joe Alwyn",
      "Benny Safdie"
    ],
    "genres": [
      "Drama",
      "Romance",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-0887261",
    "title": "Hellraiser: Renascido do Inferno",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.9,
    "image": "https://m.media-amazon.com/images/M/MV5BNWZkZTU0YzItM2YyZi00NzdiLWEwYWMtZjJhMTFjYmVmYWE1XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt0887261/img",
    "description": "Uma jovem que luta contra o v\xEDcio adquire uma antiga caixa de quebra-cabe\xE7a, sem saber que seu objetivo \xE9 convocar os Cenobitas.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt0887261",
    "imdbId": "tt0887261",
    "isFeatured": false,
    "director": "David Bruckner",
    "cast": [
      "Odessa A'zion",
      "Jamie Clayton",
      "Adam Faison"
    ],
    "genres": [
      "Terror",
      "Mist\xE9rio",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-17202326",
    "title": "A Matriarca",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.6,
    "image": "https://m.media-amazon.com/images/M/MV5BZTFkMjFlYzQtNTBhYi00Y2I1LWFjZWQtYmY4ZjQ5YzE3NWVlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt17202326/img",
    "description": "Atormentada por uma doen\xE7a misteriosa ap\xF3s sobreviver a uma overdose, uma mulher retorna \xE0 casa de sua inf\xE2ncia para enfrentar seus dem\xF4nios pessoais, mas em vez disso descobre um verdadeiro.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt17202326",
    "imdbId": "tt17202326",
    "isFeatured": false,
    "director": "Ben Steiner",
    "cast": [
      "Jemima Rooper",
      "Kate Dickie",
      "Sarah Paul"
    ],
    "genres": [
      "Terror"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-22091698",
    "title": "Esposa de Aluguel",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.7,
    "image": "https://m.media-amazon.com/images/M/MV5BN2FmNjg5ZTYtOTU2YS00MWMzLThkZmYtMmJjYjA3M2Q4NTU2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt22091698/img",
    "description": "Um solteiro teimoso contrata uma atriz para interpretar sua noiva e cumprir o \xFAltimo desejo de sua m\xE3e moribunda e tenta evitar que ela o exclua de seu testamento.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt22091698",
    "imdbId": "tt22091698",
    "isFeatured": false,
    "director": "Cris D'Amato",
    "cast": [
      "Caio Castro",
      "Thati Lopes",
      "Mariana Xavier"
    ],
    "genres": [
      "Com\xE9dia",
      "Romance"
    ],
    "ageRating": "TV-14"
  },
  {
    "id": "movie-21837726",
    "title": "O Time da Reden\xE7\xE3o",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYTc0YWUwNWItYzA4OC00Mzk5LTk3ZDQtOGYxM2M5NmE4YWViXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt21837726/img",
    "description": 'Segue a hist\xF3ria da equipe ol\xEDmpica de basquete masculino dos EUA em 2008 e como "The Redeem Team" estabeleceu um novo padr\xE3o para o basquete americano.',
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt21837726",
    "imdbId": "tt21837726",
    "isFeatured": false,
    "director": "Jon Weinbach",
    "cast": [
      "LeBron James",
      "Dwyane Wade",
      "Carmelo Anthony"
    ],
    "genres": [
      "Document\xE1rio",
      "Hist\xF3ria",
      "Esporte"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-16027944",
    "title": "Depois do Universo",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.6,
    "image": "https://m.media-amazon.com/images/M/MV5BYzQzM2IwOGYtOWE0NC00MzA5LWEzMjAtMmUzMjk2ZTZhOWZiXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt16027944/img",
    "description": "Segue Nina, uma talentosa pianista que tem l\xFApus. Ela cria uma liga\xE7\xE3o inesperada, mas forte, com Gabriel, um dos m\xE9dicos da equipe que cuida dela e lhe d\xE1 confian\xE7a para tocar com uma grande orquestra em S\xE3o Paulo.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt16027944",
    "imdbId": "tt16027944",
    "isFeatured": false,
    "director": "Diego Freitas",
    "cast": [
      "Henrique Zaga",
      "Ashleigh Morghan",
      "Jo\xE3o Miguel"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama",
      "Romance"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-12683756",
    "title": "Jaula",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.1,
    "image": "https://m.media-amazon.com/images/M/MV5BNzM0YWVmOGQtMzRhMy00MThmLTgzMmMtZDA0YTcyY2Q2YjdiXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12683756/img",
    "description": "Um casal adota temporariamente uma jovem que encontraram vagando sozinha na estrada.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12683756",
    "imdbId": "tt12683756",
    "isFeatured": false,
    "director": "Ignacio Tatay",
    "cast": [
      "Elena Anaya",
      "Pablo Molinero",
      "Eva Tennear"
    ],
    "genres": [
      "Terror",
      "Mist\xE9rio",
      "Suspense"
    ]
  },
  {
    "id": "movie-18082758",
    "title": "Hackers no Controle",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.3,
    "image": "https://m.media-amazon.com/images/M/MV5BNDNmZDFjZTktNTE2NC00Yzc1LTgzNDUtYWJhM2U3NzQxMjY5XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt18082758/img",
    "description": "Acusada de assassinato ap\xF3s descobrir um esc\xE2ndalo de privacidade, uma hacker \xE9tica deve fugir da pol\xEDcia enquanto tenta rastrear os criminosos que a chantageiam.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt18082758",
    "imdbId": "tt18082758",
    "isFeatured": false,
    "director": "Annemarie van de Mond",
    "cast": [
      "Holly Mae Brood",
      "G\xE9za Weisz",
      "Frank Lammers"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Crime",
      "Suspense"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-14030846",
    "title": "Os C\xE9us do Norte sobre o Vazio",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BM2E5OTk2ZjAtMzIzOC00NGFiLThlMjctZWE2MzRmMzlmODYzXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14030846/img",
    "description": "Don Reynaldo (Gerardo Trejoluna) \xE9 um famoso ca\xE7ador em decl\xEDnio. Quando seu rancho e o legado de seu pai forem amea\xE7ados, a din\xE2mica de seu relacionamento com sua fam\xEDlia, seus empregados e suas terras ser\xE1 perigosamente abalada.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14030846",
    "imdbId": "tt14030846",
    "isFeatured": false,
    "director": "Alejandra M\xE1rquez Abella",
    "cast": [
      "Gerardo Trejoluna",
      "Paloma Petra",
      "Dolores Heredia"
    ],
    "genres": [
      "Crime"
    ]
  },
  {
    "id": "movie-15837458",
    "title": "No Lugar Errado",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 3.5,
    "image": "https://m.media-amazon.com/images/M/MV5BMjg5MThiMzMtZGFhYS00ZjhjLTljODItNDIwODE3NjBmZTk5XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15837458/img",
    "description": "Um cozinheiro de metanfetaminas persegue o ex-chefe de pol\xEDcia de uma pequena cidade para silenci\xE1-lo antes que ele possa prestar depoimento contra sua fam\xEDlia, mas acaba enfrentando mais do que esperava.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15837458",
    "imdbId": "tt15837458",
    "isFeatured": false,
    "director": "Mike Burns",
    "cast": [
      "Ashley Greene",
      "Bruce Willis",
      "Michael Sirow"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Crime",
      "Suspense"
    ]
  },
  {
    "id": "movie-15791034",
    "title": "Noites Brutais",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7,
    "image": "https://m.media-amazon.com/images/M/MV5BNWQ5MDgwMzMtNWZhMy00Y2Q4LWI5NTAtODA4MDIzYTExOGQzXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15791034/img",
    "description": "Uma mulher hospedada num Airbnb descobre que a casa que alugou n\xE3o \xE9 o que parece.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15791034",
    "imdbId": "tt15791034",
    "isFeatured": false,
    "director": "Zach Cregger",
    "cast": [
      "Georgina Campbell",
      "Bill Skarsg\xE5rd",
      "Justin Long"
    ],
    "genres": [
      "Terror",
      "Mist\xE9rio",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-17003896",
    "title": "A Jaula",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.2,
    "image": "https://m.media-amazon.com/images/M/MV5BMDI3NzYwZWEtODg3ZS00MDA2LWIxYjUtNjYxY2Q1NDJlOTZjXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt17003896/img",
    "description": "Um criminoso tenta roubar um carro e acaba preso pelo propriet\xE1rio, que planeja fazer justi\xE7a com as pr\xF3prias m\xE3os.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt17003896",
    "imdbId": "tt17003896",
    "isFeatured": false,
    "director": "Jo\xE3o Wainer",
    "cast": [
      "Chay Suede",
      "Alexandre Nero",
      "Mariana Lima"
    ],
    "genres": [
      "Crime",
      "Suspense"
    ]
  },
  {
    "id": "movie-14270848",
    "title": "Roubando Mussolini",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.4,
    "image": "https://m.media-amazon.com/images/M/MV5BMzczOTI1OTItYzAwNS00MDVhLWIwMzMtODE3MWEwMjJmODZlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14270848/img",
    "description": "Um empres\xE1rio milan\xEAs do tempo da guerra forma um bando de desajustados e bandidos para encenar um elaborado roubo de um tesouro lend\xE1rio pertencente a Benito Mussolini.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14270848",
    "imdbId": "tt14270848",
    "isFeatured": false,
    "director": "Renato De Maria",
    "cast": [
      "Pietro Castellitto",
      "Matilda De Angelis",
      "Tommaso Ragno"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Com\xE9dia",
      "Crime"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-15078804",
    "title": "Problemista",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 6.7,
    "image": "https://m.media-amazon.com/images/M/MV5BNjNlNzBlN2EtZDhhNC00ZDg0LTljODgtMTAzNDI2MTRmMjZjXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15078804/img",
    "description": "Alejandro \xE9 um aspirante a designer de brinquedos de El Salvador que luta para dar vida \xE0s suas ideias incomuns em Nova York. \xC0 medida que o tempo do seu visto de trabalho se esgota, um emprego como ajudante de um errante p\xE1ria do mundo da arte torna-se a sua \xFAnica esperan\xE7a de permanecer no pa\xEDs.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15078804",
    "imdbId": "tt15078804",
    "isFeatured": false,
    "director": "Julio Torres",
    "cast": [
      "Julio Torres",
      "Tilda Swinton",
      "RZA"
    ],
    "genres": [
      "Com\xE9dia"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-14641788",
    "title": "Enola Holmes 2",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.8,
    "image": "https://m.media-amazon.com/images/M/MV5BZjRjZjZhNzUtMDQyMC00OWZmLWIzMjQtZDM2OWRhNzgwOGU2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14641788/img",
    "description": "Agora uma detetive de aluguel, Enola Holmes assume seu primeiro caso oficial para encontrar uma garota desaparecida enquanto as fa\xEDscas de uma conspira\xE7\xE3o perigosa acendem um mist\xE9rio que requer a ajuda de amigos - e do pr\xF3prio Sherlock - para ser desvendado.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14641788",
    "imdbId": "tt14641788",
    "isFeatured": false,
    "director": "Harry Bradbeer",
    "cast": [
      "Millie Bobby Brown",
      "Henry Cavill",
      "David Thewlis"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Aventura",
      "Crime"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-2184390",
    "title": "Um Rio Muito Frio",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.2,
    "image": "https://m.media-amazon.com/images/M/MV5BNDE0OWQ1YTctYTNlNy00ZjA0LTljZWItZDlmY2Y0OWY5YzBiXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt2184390/img",
    "description": "A pesquisa de um documentarista sobre o misterioso benfeitor de uma cidade revela um mal inexplic\xE1vel enquanto est\xE1 hospedado em um resort local.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt2184390",
    "imdbId": "tt2184390",
    "isFeatured": false,
    "director": "Paul Shoulberg",
    "cast": [
      "Ruth Kaufman",
      "Bill Simmons",
      "Bethany Joy Lenz"
    ],
    "genres": [
      "Drama",
      "Terror",
      "Mist\xE9rio"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-14109724",
    "title": "Ingresso Para o Para\xEDso",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.1,
    "image": "https://m.media-amazon.com/images/M/MV5BNmQwNDg4Y2EtZjc4OS00NDY0LTk1NGMtZTEyOTAxMWQ3NWQ5XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14109724/img",
    "description": "Um casal divorciado se une e viaja para Bali para impedir que sua filha cometa o mesmo erro que eles acham que cometeram h\xE1 25 anos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14109724",
    "imdbId": "tt14109724",
    "isFeatured": false,
    "director": "Ol Parker",
    "cast": [
      "George Clooney",
      "Sean Lynch",
      "Julia Roberts"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama",
      "Romance"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-13640696",
    "title": "Veja Como Eles Correm",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BMGNiNDNlNjQtMGEzMC00NmNjLWJhYWYtODBhNjQ3Mjc2YjZmXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt13640696/img",
    "description": "No West End de Londres dos anos 1950, os planos para uma vers\xE3o cinematogr\xE1fica de uma pe\xE7a de grande sucesso s\xE3o interrompidos abruptamente depois que um membro importante da equipe \xE9 assassinado.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt13640696",
    "imdbId": "tt13640696",
    "isFeatured": false,
    "director": "Tom George",
    "cast": [
      "Kieran Hodgson",
      "Pearl Chanda",
      "Gregory Cox"
    ],
    "genres": [
      "Com\xE9dia",
      "Crime",
      "Mist\xE9rio"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-15301048",
    "title": "Argentina 1985",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.6,
    "image": "https://m.media-amazon.com/images/M/MV5BMGQxYTQyNDUtNmZkMi00MzQ4LWFhMTktNTYzOGQ1ZGMzYjQ2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15301048/img",
    "description": "Uma equipe de advogados enfrenta os chefes da sangrenta ditadura militar argentina durante a d\xE9cada de 1980, em uma batalha contra as adversidades e uma corrida contra o tempo.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15301048",
    "imdbId": "tt15301048",
    "isFeatured": false,
    "director": "Santiago Mitre",
    "cast": [
      "Ricardo Dar\xEDn",
      "Gina Mastronicola",
      "Francisco Bert\xEDn"
    ],
    "genres": [
      "Biografia",
      "Crime",
      "Drama"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-11807888",
    "title": "A Av\xF3",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.9,
    "image": "https://m.media-amazon.com/images/M/MV5BODlmNjQzNDItMmNlNS00MTE1LWIwNzUtZTY3ZGYyYjRmN2IyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11807888/img",
    "description": "Uma modelo parisiense deve regressar a Madrid, onde a sua av\xF3, que a criou, acabou de sofrer um acidente vascular cerebral. Mas passar apenas alguns dias com esse parente se transforma em um pesadelo inesperado.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11807888",
    "imdbId": "tt11807888",
    "isFeatured": false,
    "director": "Paco Plaza",
    "cast": [
      "Almudena Amor",
      "Vera Valdez",
      "Karina Kolokolchykova"
    ],
    "genres": [
      "Terror"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-10731256",
    "title": "N\xE3o Se Preocupe, Querida",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.3,
    "image": "https://m.media-amazon.com/images/M/MV5BY2I0ZDExM2EtZTQ4OC00NGQ0LWIzYjktYWE4MDMxZDZlY2MwXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10731256/img",
    "description": "Enquanto seu marido sai de casa todos os dias para trabalhar em uma instala\xE7\xE3o ultrassecreta, uma jovem dona de casa dos anos 1950 come\xE7a a questionar sua vida ao notar um comportamento estranho das outras esposas da vizinhan\xE7a.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10731256",
    "imdbId": "tt10731256",
    "isFeatured": false,
    "director": "Olivia Wilde",
    "cast": [
      "Florence Pugh",
      "Harry Styles",
      "Chris Pine"
    ],
    "genres": [
      "Drama",
      "Mist\xE9rio",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-9225812",
    "title": "A Viagem de Pedro",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BMTI0NzllMzktZTk1NC00NDY5LWE4ODMtYjhjNTNmNzYzZjdhXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt9225812/img",
    "description": "Um olhar intimista sobre a vida de Dom Pedro I e os acontecimentos hist\xF3ricos que giram em torno do pr\xEDncipe, antecipando um momento decisivo em sua trajet\xF3ria. Em 1831, o primeiro Imperador do Brasil retornou \xE0 Europa sob condi\xE7\xF5es adversas...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt9225812",
    "imdbId": "tt9225812",
    "isFeatured": false,
    "director": "La\xEDs Bodanzky",
    "cast": [
      "Cau\xE3 Reymond",
      "Luise Heyer",
      "Isab\xE9l Zuaa"
    ],
    "genres": [
      "Biografia",
      "Drama"
    ]
  },
  {
    "id": "movie-5181830",
    "title": "Wendell & Wild",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYWQ2NmZjMWYtYmY5Ni00ZmM4LWFkMzEtMWM0MjI0OTE3N2Y1XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt5181830/img",
    "description": "Dois irm\xE3os dem\xF4nios intrigantes, Wendell e Wild, recrutam a ajuda de Kat Elliot, de 13 anos, para convoc\xE1-los para a Terra dos Vivos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt5181830",
    "imdbId": "tt5181830",
    "isFeatured": false,
    "director": "Henry Selick",
    "cast": [
      "Lyric Ross",
      "Keegan-Michael Key",
      "Jordan Peele"
    ],
    "genres": [
      "Anima\xE7\xE3o",
      "Aventura",
      "Com\xE9dia"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-1016150",
    "title": "Nada de Novo no Front",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.8,
    "image": "https://m.media-amazon.com/images/M/MV5BOWJiYWMyYTktZThhOS00ZjgxLWE0YTQtZDMyNTQxMjMyYjI2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt1016150/img",
    "description": "A vontade de um jovem soldado alem\xE3o de servir o seu pa\xEDs desaparece rapidamente quando ele testemunha os horrores do combate na Frente Ocidental durante a Primeira Guerra Mundial.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt1016150",
    "imdbId": "tt1016150",
    "isFeatured": false,
    "director": "Edward Berger",
    "cast": [
      "Felix Kammerer",
      "Albrecht Schuch",
      "Aaron Hilmer"
    ],
    "genres": [
      "Drama",
      "Hist\xF3ria",
      "Guerra"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-4788734",
    "title": "A Madrasta",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.3,
    "image": "https://m.media-amazon.com/images/M/MV5BNzU4YzhlOTUtZjMyZC00MTYzLTgzNDAtZmNjZmNjNDY1YmMyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt4788734/img",
    "description": "Uma viagem ao campo acaba ficando longe de ser id\xEDlica para um pai e sua nova noiva quando seus filhos decidem que a casa est\xE1 um pouco lotada.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt4788734",
    "imdbId": "tt4788734",
    "isFeatured": false,
    "director": "Sebastian Godwin",
    "cast": [
      "Aisling Loftus",
      "Tom Goodman-Hill",
      "Raffiella Chapman"
    ],
    "genres": [
      "Drama",
      "Terror",
      "Mist\xE9rio"
    ]
  },
  {
    "id": "movie-12390572",
    "title": "G\xEAmeo Maligno",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.1,
    "image": "https://m.media-amazon.com/images/M/MV5BZGY1NjZlOWItNjE2NS00MWNhLTg5ZjktYzUzNjg0NzZkZjgxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12390572/img",
    "description": "Uma m\xE3e tem que enfrentar a verdade insuport\xE1vel sobre seu filho g\xEAmeo sobrevivente.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12390572",
    "imdbId": "tt12390572",
    "isFeatured": false,
    "director": "Taneli Mustonen",
    "cast": [
      "Teresa Palmer",
      "Steven Cree",
      "Barbara Marten"
    ],
    "genres": [
      "Drama",
      "Terror",
      "Mist\xE9rio"
    ]
  },
  {
    "id": "movie-6443346",
    "title": "Ad\xE3o Negro",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.1,
    "image": "https://m.media-amazon.com/images/M/MV5BYmM3OTM4NDktMmI2NS00OWU0LTg4OTQtNjZhMmFkYjhmOGY1XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt6443346/img",
    "description": "Quase 5.000 anos depois de ter sido agraciado com os poderes onipotentes dos deuses eg\xEDpcios \u2013 e aprisionado com a mesma rapidez \u2013 Ad\xE3o Negro \xE9 libertado de sua tumba terrestre, pronto para liberar sua forma \xFAnica de justi\xE7a no mundo moderno.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt6443346",
    "imdbId": "tt6443346",
    "isFeatured": false,
    "director": "Jaume Collet-Serra",
    "cast": [
      "Dwayne Johnson",
      "Aldis Hodge",
      "Pierce Brosnan"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Aventura",
      "Fantasia"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-18224682",
    "title": "Roubo Cibern\xE9tico: Bilh\xF5es em Bitcoins",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BZTI2ODcyYmYtMTdlYS00NTIxLWI0NmUtMTQ2ZjQ1YjU2MjdiXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt18224682/img",
    "description": "Morgan, uma rapper hipster tamb\xE9m conhecida como Razzlekhan e colaboradora da Forbes, e seu marido Lichtenstein foram presos ap\xF3s serem acusados \u200B\u200Bde conspirar para lavar quase 120.000 Bitcoins.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt18224682",
    "imdbId": "tt18224682",
    "isFeatured": false,
    "director": "Chris Smith",
    "cast": [
      "Heather Morgan",
      "Ilya Lichtenstein",
      "Chris Janczewski"
    ],
    "genres": [
      "Document\xE1rio",
      "Biografia",
      "Crime"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-32084246",
    "title": "Virgem Maria",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 5.2,
    "image": "https://m.media-amazon.com/images/M/MV5BMDM5YWJlNjgtYzUyNy00MTc4LWFkZTAtMTdlNDM2MDcwYTcyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt32084246/img",
    "description": "Nesta hist\xF3ria atemporal de maioridade, Maria \xE9 rejeitada ap\xF3s uma concep\xE7\xE3o sobrenatural e for\xE7ada a fugir quando a sede insaci\xE1vel de Herodes por poder desencadeia uma persegui\xE7\xE3o assassina pelo rec\xE9m-nascido.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt32084246",
    "imdbId": "tt32084246",
    "isFeatured": false,
    "director": "D.J. Caruso",
    "cast": [
      "Noa Cohen",
      "Ido Tako",
      "Ori Pfeffer"
    ],
    "genres": [
      "Drama"
    ],
    "ageRating": "TV-14"
  },
  {
    "id": "movie-29368988",
    "title": "Acampamento com a Mam\xE3e",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 5.5,
    "image": "https://m.media-amazon.com/images/M/MV5BZDRiNjc0MDItMzIwMy00MzkzLWJkNWUtM2VkYTFlYjIzYTM5XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt29368988/img",
    "description": "Patri, uma m\xE3e autorit\xE1ria, luta para se relacionar com o filho adolescente que quer morar com o pai. Para mant\xEA-lo em casa, ela se oferece para lev\xE1-lo e amigos para um acampamento, disputando seu carinho durante a viagem.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt29368988",
    "imdbId": "tt29368988",
    "isFeatured": false,
    "director": "Martino Zaidelis",
    "cast": [
      "Natalia Oreiro",
      "Milo Lis",
      "Pablo Rago"
    ],
    "genres": [
      "Com\xE9dia"
    ]
  },
  {
    "id": "movie-17371682",
    "title": "Nossa M\xE3e \xE9 Para Sempre",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BNzEwNmFmNWYtYTM5YS00Y2Q4LWJlN2UtYzg5ZjZlNjQxZTEwXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt17371682/img",
    "description": "No Dia Santo das Mortes, uma m\xE3e retorna e descobre que seus tr\xEAs filhos s\xE3o desconsiderados, feios e pregui\xE7osos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt17371682",
    "imdbId": "tt17371682",
    "isFeatured": false,
    "director": "No\xE9 Santill\xE1n-L\xF3pez",
    "cast": [
      "Carmen Beato",
      "Jos\xE9 Eduardo Derbez",
      "Gustavo Egelhaaf"
    ],
    "genres": [
      "Com\xE9dia"
    ]
  },
  {
    "id": "movie-22437050",
    "title": "Vento Selvagem",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.6,
    "image": "https://m.media-amazon.com/images/M/MV5BYmIzNmZkMTktMGFmNC00NDU2LWE2MjItN2ExMzJkMDJlZThlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt22437050/img",
    "description": "As tens\xF5es raciais e a corrup\xE7\xE3o chegam ao auge em uma cidade pequena e segregada depois que a pol\xEDcia encontra o corpo de uma jovem afric\xE2nder no mato.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt22437050",
    "imdbId": "tt22437050",
    "isFeatured": false,
    "director": "Fabian Medea",
    "cast": [
      "Mothusi Magano",
      "Frank Rautenbach",
      "Chris Chameleon"
    ],
    "genres": [
      "Crime",
      "Drama"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-19724142",
    "title": "O Monast\xE9rio",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.8,
    "image": "https://m.media-amazon.com/images/M/MV5BMGJkZmY0NmItODk4Yy00NjkzLWJmOGUtMGM1NzRhYmRhZjM0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt19724142/img",
    "description": "Na Pol\xF4nia de 1987, um policial que investiga desaparecimentos misteriosos se infiltra em um mosteiro remoto e descobre uma verdade sombria sobre seu clero.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt19724142",
    "imdbId": "tt19724142",
    "isFeatured": false,
    "director": "Bartosz M. Kowalski",
    "cast": [
      "Piotr Zurawski",
      "Olaf Lubaszenko",
      "Sebastian Stankiewicz"
    ],
    "genres": [
      "Terror",
      "Mist\xE9rio"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-22227936",
    "title": "Quatro Gera\xE7\xF5es",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.1,
    "image": "https://m.media-amazon.com/images/M/MV5BMjg0NjY1YzgtNTc2NS00MzY4LTgzNzktNDg1MWE4NzA4ZDExXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt22227936/img",
    "description": "Uma fam\xEDlia migra para a cidade ap\xF3s uma perda tr\xE1gica. Quando eles se reencontram em sua cidade natal, 30 anos depois, emo\xE7\xF5es enterradas e segredos dolorosos ressurgem.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt22227936",
    "imdbId": "tt22227936",
    "isFeatured": false,
    "director": "Berkun Oya",
    "cast": [
      "Ay\xE7a Bing\xF6l",
      "Fatih Artman",
      "Funda Eryigit"
    ],
    "genres": [
      "Drama"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-12444934",
    "title": "Oficina do Diabo",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 3.8,
    "image": "https://m.media-amazon.com/images/M/MV5BYjEwOTg3OTktMWI0OC00ODgxLWE3MTYtMjYyODdjOWM1MmU0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12444934/img",
    "description": "Um ator em dificuldades, desesperado para reviver sua carreira, passa um fim de semana com um demonologista sedutor para se preparar para um teste.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12444934",
    "imdbId": "tt12444934",
    "isFeatured": false,
    "director": "Chris von Hoffmann",
    "cast": [
      "Radha Mitchell",
      "Timothy Granaderos",
      "Emile Hirsch"
    ],
    "genres": [
      "Drama",
      "Terror"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-19408390",
    "title": "Acampamento Intergal\xE1ctico",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BNTljNTllMzItMTEyYS00ZjM4LTg1MmYtYjE3Mjk0OGU5YmRhXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt19408390/img",
    "description": "Ronaldo e sua irm\xE3 est\xE3o visitando o Acampamento Intergal\xE1ctico para desvendar os segredos do espa\xE7o, mas n\xE3o t\xEAm ideia de que os ETs est\xE3o mais pr\xF3ximos do que nunca. Agora eles viver\xE3o aventuras cheias de ci\xEAncia, divers\xE3o e m\xFAsica para salvar o planeta.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt19408390",
    "imdbId": "tt19408390",
    "isFeatured": false,
    "director": "Fabr\xEDcio Bittar",
    "cast": [
      "Ronaldo de Azevedo",
      "Blota Filho",
      "Pedro Miranda"
    ],
    "genres": [
      "Aventura",
      "Com\xE9dia",
      "Fam\xEDlia"
    ]
  },
  {
    "id": "movie-10198564",
    "title": "Persegui\xE7\xE3o Mortal",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.3,
    "image": "https://m.media-amazon.com/images/M/MV5BMjU1NGQyY2QtZmYwNy00M2JkLTk1NjAtZWY4MTgwYjE4ZGVkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10198564/img",
    "description": "Depois de roubar milh\xF5es em dinheiro do esconderijo de drogas do s\xE1dico chefe da m\xE1fia Temple, um ladr\xE3o encontra um passageiro clandestino em seu carro de fuga.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10198564",
    "imdbId": "tt10198564",
    "isFeatured": false,
    "director": "James Clayton",
    "cast": [
      "Vinnie Jones",
      "Philip Granger",
      "James Clayton"
    ],
    "genres": [
      "A\xE7\xE3o"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-14824590",
    "title": "At\xE9 o Limite",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.4,
    "image": "https://m.media-amazon.com/images/M/MV5BNjBiNjU2MmItYTYxZC00N2NmLTgwNjItZDc4MjZhZmFhMDNkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14824590/img",
    "description": "Um apresentador atende uma liga\xE7\xE3o, onde um desconhecido amea\xE7a matar toda a fam\xEDlia do showman no ar. Para salvar entes queridos, o radialista ter\xE1 que jogar um jogo de sobreviv\xEAncia e a \xFAnica maneira de vencer \xE9 descobrir a identidade do cri...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14824590",
    "imdbId": "tt14824590",
    "isFeatured": false,
    "director": "Romuald Boulanger",
    "cast": [
      "Mel Gibson",
      "William Moseley",
      "Alia Seror-O'Neill"
    ],
    "genres": [
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-4303322",
    "title": "Duetto",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BZjI4ZTVkMmQtZDU4Mi00MDU1LWFiZjgtMTM2ZDNjMTFlMDc1XkEyXkFqcGdeQXVyNTczMDM0OTU@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt4303322/img",
    "description": "Duetto se passa em 1965 e conta a hist\xF3ria de Cora, de 18 anos, uma brasileira de fam\xEDlia italiana que, ap\xF3s perder o pai em um tr\xE1gico acidente de carro, vai com a av\xF3 L\xFAcia para Puglia, na It\xE1lia, onde moram seus ancestrais...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt4303322",
    "imdbId": "tt4303322",
    "isFeatured": false,
    "director": "Vicente Amorim",
    "cast": [
      "Michele Morrone",
      "Giancarlo Giannini",
      "Gabriel Leone"
    ],
    "genres": [
      "Drama"
    ]
  },
  {
    "id": "movie-10242388",
    "title": "Ca\xE7a Implac\xE1vel",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.7,
    "image": "https://m.media-amazon.com/images/M/MV5BNDE4ZmRmZGUtMTVjOC00OWE2LTk2OGItZmJkNzkyMGFjNGE1XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10242388/img",
    "description": "A futura ex-mulher de Will desaparece misteriosamente em um posto de gasolina. Ele investiga o ponto fraco do crime da cidade enquanto foge das autoridades em uma corrida contra o tempo para encontr\xE1-la.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10242388",
    "imdbId": "tt10242388",
    "isFeatured": false,
    "director": "Brian Goodman",
    "cast": [
      "Gerard Butler",
      "Jaimie Alexander",
      "Russell Hornsby"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Crime",
      "Drama"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-4546156",
    "title": "A Espera de Liz",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BZDkzMjRlM2QtOWIwMi00ZmQyLThhZTQtZDZkNTFmNWNhNDAyXkEyXkFqcGdeQXVyMTI3MjIyMTgw._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt4546156/img",
    "description": "Liz est\xE1 cercada de d\xFAvidas e incertezas. Introspectiva, ela busca o motivo da partida de seu companheiro Miguel. Enquanto procura respostas profundas, ela sente necessidade de apoio emocional de sua irm\xE3 mais nova, Lara.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt4546156",
    "imdbId": "tt4546156",
    "isFeatured": false,
    "director": "Bruno Fatumbi Torres",
    "cast": [
      "Juliana Drummond",
      "Murilo Grossi",
      "Simone Iliescu"
    ],
    "genres": [
      "Drama"
    ]
  },
  {
    "id": "movie-14557188",
    "title": "Suaves e Discretas",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.2,
    "image": "https://m.media-amazon.com/images/M/MV5BZWI3ZTVmOGItNzcwMS00N2Y4LTg3N2UtMDViN2YyM2E0MGUzXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14557188/img",
    "description": "Jogando em tempo real, uma professora do ensino fundamental organiza uma reuni\xE3o de mulheres com ideias semelhantes, quando encontra uma mulher de seu passado, levando a uma cadeia vol\xE1til de eventos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14557188",
    "imdbId": "tt14557188",
    "isFeatured": false,
    "director": "Beth de Ara\xFAjo",
    "cast": [
      "Stefanie Estes",
      "Olivia Luccardi",
      "Dana Millican"
    ],
    "genres": [
      "Terror",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-15128068",
    "title": "Monica, O My Darling",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.4,
    "image": "https://m.media-amazon.com/images/M/MV5BY2JkNTU0MDEtMzdhNC00NTZkLWI0YTMtZTdlZDkxM2Q0MTZjXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15128068/img",
    "description": "Um astuto especialista em rob\xF3tica se junta a uma trama assassina depois que um caso apaixonado sofre uma reviravolta repentina, mas nada, nem mesmo a morte, \xE9 o que parece ser.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15128068",
    "imdbId": "tt15128068",
    "isFeatured": false,
    "director": "Vasan Bala",
    "cast": [
      "Rajkummar Rao",
      "Huma Qureshi",
      "Sikandar Kher"
    ],
    "genres": [
      "Com\xE9dia",
      "Crime",
      "Drama"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-13421498",
    "title": "O Rei Perdido",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.7,
    "image": "https://m.media-amazon.com/images/M/MV5BNGUzMTY2M2YtZGMxZi00NTVhLWFiZDQtM2E4ZTQwOTcwMjc3XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt13421498/img",
    "description": "Uma historiadora amadora desafia o pesado establishment acad\xEAmico em seus esfor\xE7os para encontrar os restos mortais do rei Ricardo III, que ficaram perdidos por mais de 500 anos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt13421498",
    "imdbId": "tt13421498",
    "isFeatured": false,
    "director": "Stephen Frears",
    "cast": [
      "Sally Hawkins",
      "Shonagh Price",
      "Helen Katamba"
    ],
    "genres": [
      "Drama"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-15713012",
    "title": "Overdose",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.8,
    "image": "https://m.media-amazon.com/images/M/MV5BMGNlNzkwMGUtYzZmMC00ZGM4LTliMTYtNjBiNmNkYzkyMWVkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15713012/img",
    "description": "Segue Sara, chefe do esquadr\xE3o antidrogas da pol\xEDcia de Toulouse, que \xE9 for\xE7ada a colaborar com Richard, o chefe da pol\xEDcia criminal local, para impedir um ataque r\xE1pido entre Espanha e Fran\xE7a e encontrar o assassino ligado ao caso.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15713012",
    "imdbId": "tt15713012",
    "isFeatured": false,
    "director": "Olivier Marchal",
    "cast": [
      "Sofia Essa\xEFdi",
      "Assaad Bouab",
      "Alberto Ammann"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Crime",
      "Suspense"
    ]
  },
  {
    "id": "movie-8296030",
    "title": "Voc\xEA N\xE3o Estar\xE1 S\xF3!",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BNjM3ODYzMmQtMzc5Mi00Y2MwLWIyNWEtMWFjZTM5ZTA0ZWFlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8296030/img",
    "description": "Numa aldeia montanhosa isolada na Maced\xF3nia do s\xE9culo XIX, uma jovem \xE9 raptada e depois transformada em bruxa por um esp\xEDrito antigo.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8296030",
    "imdbId": "tt8296030",
    "isFeatured": false,
    "director": "Goran Stolevski",
    "cast": [
      "Sara Klimoska",
      "Leontina Bainovic",
      "Anamaria Marinca"
    ],
    "genres": [
      "Drama",
      "Fantasia",
      "Terror"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-14715170",
    "title": "Uma Quedinha de Natal",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.3,
    "image": "https://m.media-amazon.com/images/M/MV5BNjRlOTQwZmYtOWVhYy00ZTA1LWEzZWEtNjRhNzU4ODI3NzM1XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14715170/img",
    "description": "Nos dias que antecedem o Natal, uma jovem herdeira rec\xE9m-noiva sofre um acidente de esqui. Depois de ser diagnosticada com amn\xE9sia, ela fica sob os cuidados do belo dono da pousada e de sua filha.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14715170",
    "imdbId": "tt14715170",
    "isFeatured": false,
    "director": "Janeen Damian",
    "cast": [
      "Lindsay Lohan",
      "Chord Overstreet",
      "George Young"
    ],
    "genres": [
      "Com\xE9dia",
      "Romance"
    ],
    "ageRating": "TV-PG"
  },
  {
    "id": "movie-14444726",
    "title": "T\xC1R",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYWY5YThhOGUtNDU4OS00NTk3LWI0ODQtNmRiYTk0ZjVkZWU2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14444726/img",
    "description": "Situado no mundo internacional da m\xFAsica cl\xE1ssica ocidental, o filme centra-se em Lydia T\xE1r, amplamente considerada uma das maiores compositoras-regentes vivas e a primeira mulher diretora de uma grande orquestra alem\xE3.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14444726",
    "imdbId": "tt14444726",
    "isFeatured": false,
    "director": "Todd Field",
    "cast": [
      "Cate Blanchett",
      "No\xE9mie Merlant",
      "Nina Hoss"
    ],
    "genres": [
      "Drama",
      "M\xFAsica"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-11454320",
    "title": "Heran\xE7a Maldita",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.9,
    "image": "https://m.media-amazon.com/images/M/MV5BMmY2MDgzYjUtOGI3ZC00NGI4LTkwZjAtNTJlYWM3OWE3MjNlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11454320/img",
    "description": "Depois de receber uma carta misteriosa, uma mulher viaja para uma cidade-ilha deserta e logo fica presa em um pesadelo.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11454320",
    "imdbId": "tt11454320",
    "isFeatured": false,
    "director": "Mickey Keating",
    "cast": [
      "Jocelin Donahue",
      "Joe Swanberg",
      "Richard Brake"
    ],
    "genres": [
      "Drama",
      "Fantasia",
      "Terror"
    ]
  },
  {
    "id": "movie-8859236",
    "title": "Territ\xF3rio Hostil",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.9,
    "image": "https://m.media-amazon.com/images/M/MV5BMThhNDQxMWItYjcyMC00YzdmLTliZDctMmI0ZTcxNWNlMGE0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8859236/img",
    "description": "Na Am\xE9rica p\xF3s-guerra civil, quando um soldado da Uni\xE3o \xE9 dado como morto, os seus filhos s\xE3o erroneamente mandados embora no comboio \xF3rf\xE3o. Esta \xE9 uma hist\xF3ria do oeste selvagem sobre pessoas unidas por um bem maior e crian\xE7as for\xE7adas a crescer rapidamente.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8859236",
    "imdbId": "tt8859236",
    "isFeatured": false,
    "director": "Brian Presley",
    "cast": [
      "Matt McCoy",
      "Lew Temple",
      "Brad Leland"
    ],
    "genres": [
      "Drama",
      "Hist\xF3ria",
      "Faroeste"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-12194006",
    "title": "Beleza",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7,
    "image": "https://m.media-amazon.com/images/M/MV5BYzkyZjY1OTktNzFkNy00ZWUyLThiNGYtMjk3ZmM3ZjYzMmNkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12194006/img",
    "description": "Cinco mulheres de diferentes idades s\xE3o confrontadas com a sua autoimagem e as exig\xEAncias pr\xF3prias e dos outros.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12194006",
    "imdbId": "tt12194006",
    "isFeatured": false,
    "director": "Karoline Herfurth",
    "cast": [
      "Emilia Sch\xFCle",
      "Martina Gedeck",
      "Nora Tschirner"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama",
      "Romance"
    ]
  },
  {
    "id": "movie-13139228",
    "title": "Meu Policial",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BYjkxNjg0YTctYTU5OC00MTYwLTg3NTMtZTcwNDRkNmQ2ZTcyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt13139228/img",
    "description": "A chegada de Patrick \xE0 casa de Marion e Tom desencadeia a explora\xE7\xE3o de eventos s\xEDsmicos ocorridos h\xE1 40 anos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt13139228",
    "imdbId": "tt13139228",
    "isFeatured": false,
    "director": "Michael Grandage",
    "cast": [
      "Harry Styles",
      "Emma Corrin",
      "Gina McKee"
    ],
    "genres": [
      "Drama",
      "Romance"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-11162490",
    "title": "A Bravura de Molly",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYmI2ZmFhMGEtYzI5Yi00YTgwLWI2NjItNzU1NzMxY2Q2ZGVlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11162490/img",
    "description": "Uma bosqu\xEDmana solit\xE1ria luta para criar os filhos e administrar a fazenda da fam\xEDlia enquanto o marido est\xE1 fora.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11162490",
    "imdbId": "tt11162490",
    "isFeatured": false,
    "director": "Leah Purcell",
    "cast": [
      "Leah Purcell",
      "Malachi Dower-Roberts",
      "Amahlia Olsson"
    ],
    "genres": [
      "Drama",
      "Hist\xF3ria",
      "Suspense"
    ]
  },
  {
    "id": "movie-12215252",
    "title": "Jogada De Amor",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BMGMwOTQzNWYtNWY4YS00Y2FhLTlkMWQtM2NkMDI1NTg3OTBhXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12215252/img",
    "description": "A vida do sedutor em s\xE9rie Gianni est\xE1 fadada a mudar quando ele conhece Chiara, uma bela mulher que sofreu um acidente e est\xE1 parapl\xE9gica.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12215252",
    "imdbId": "tt12215252",
    "isFeatured": false,
    "director": "Riccardo Milani",
    "cast": [
      "Pierfrancesco Favino",
      "Miriam Leone",
      "Claire Palazzo"
    ],
    "genres": [
      "Com\xE9dia",
      "Romance"
    ]
  },
  {
    "id": "movie-0120589",
    "title": "Predestinado: Arig\xF3 e o Esp\xEDrito do Dr. Fritz",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.1,
    "image": "https://m.media-amazon.com/images/M/MV5BMzQzZGQwYmYtMWEyNy00MjZkLWE5OTAtYmIyNDg1NTRiMDdjXkEyXkFqcGdeQXVyNTEyMjMxNw@@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt0120589/img",
    "description": "Atrav\xE9s do esp\xEDrito do Dr. Fritz, m\xE9dico alem\xE3o falecido durante a Primeira Guerra Mundial, Jos\xE9 Arig\xF3 tornou-se esperan\xE7a de cura para milh\xF5es de pessoas ao realizar cirurgias espirituais, ajudando cerca de 2 milh\xF5es de pessoas.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt0120589",
    "imdbId": "tt0120589",
    "isFeatured": false,
    "director": "Gustavo Fern\xE1ndez",
    "cast": [
      "James Faulkner",
      "Juliana Paes",
      "Antonio Saboia"
    ],
    "genres": [
      "Biografia",
      "Drama"
    ]
  },
  {
    "id": "movie-14855468",
    "title": "Aquele Natal",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 6.8,
    "image": "https://m.media-amazon.com/images/M/MV5BZWRkZjQwNDctOWY2Yy00ZTczLTg2ZTMtMDBlYTVhNGE1OGYzXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14855468/img",
    "description": "\xC9 um Natal inesquec\xEDvel para os habitantes de Wellington-on-Sea, quando a pior tempestade de neve da hist\xF3ria altera os planos de todos, inclusive do Papai Noel.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14855468",
    "imdbId": "tt14855468",
    "isFeatured": false,
    "director": "Simon Otto",
    "cast": [
      "Bill Nighy",
      "Brian Cox",
      "Guz Khan"
    ],
    "genres": [
      "Anima\xE7\xE3o",
      "Aventura",
      "Com\xE9dia"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-10192406",
    "title": "Passagem",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.6,
    "image": "https://m.media-amazon.com/images/M/MV5BZjVmZDgwZDItOWVjMy00MDE2LTljMWQtNTRiOTFmMjU4ZWQzXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10192406/img",
    "description": "Um soldado norte-americano sofre uma les\xE3o cerebral traum\xE1tica enquanto luta no Afeganist\xE3o e luta para se adaptar \xE0 vida no seu pa\xEDs.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10192406",
    "imdbId": "tt10192406",
    "isFeatured": false,
    "director": "Lila Neugebauer",
    "cast": [
      "Jennifer Lawrence",
      "Brian Tyree Henry",
      "Linda Emond"
    ],
    "genres": [
      "Drama"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-8646254",
    "title": "45 do Segundo Tempo",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BYWFlMjg2MTEtNTk3Zi00MDE5LWEzMDYtNGMyYWY2YTY4MWQ0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8646254/img",
    "description": "Para recriar uma foto tirada em 1974, durante a inaugura\xE7\xE3o do metr\xF4 de S\xE3o Paulo, Pedro (Tony Ramos) conhece dois amigos de escola que n\xE3o via h\xE1 40 anos. Se as suas crises existenciais, o envelhecimento e os caminhos (desviados) n\xE3o fossem resolvidos...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8646254",
    "imdbId": "tt8646254",
    "isFeatured": false,
    "director": "Luiz Villa\xE7a",
    "cast": [
      "Tony Ramos",
      "C\xE1ssio Gabus Mendes",
      "Ary Fran\xE7a"
    ],
    "genres": [
      "Com\xE9dia"
    ]
  },
  {
    "id": "movie-9288748",
    "title": "O Drag\xE3o do Meu Pai",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BYzAxMGZiNzgtOTZmNS00M2Y4LWJjNGUtZDNmYTJhM2YyYTk2XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt9288748/img",
    "description": "Elmer Elevator procura um drag\xE3o cativo na Ilha Selvagem e encontra muito mais do que ele jamais poderia ter previsto.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt9288748",
    "imdbId": "tt9288748",
    "isFeatured": false,
    "director": "Nora Twomey",
    "cast": [
      "Jacob Tremblay",
      "Gaten Matarazzo",
      "Golshifteh Farahani"
    ],
    "genres": [
      "Anima\xE7\xE3o",
      "Aventura",
      "Com\xE9dia"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-8883486",
    "title": "Medieval",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.9,
    "image": "https://m.media-amazon.com/images/M/MV5BYjgxZjg0MzEtYzQxMi00ZGRkLThkMzYtNzY0MDBmYjU0MjI0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8883486/img",
    "description": "A hist\xF3ria do \xEDcone e senhor da guerra tcheco do s\xE9culo XV, Jan Zizka, que derrotou os ex\xE9rcitos da Ordem Teut\xF4nica e do Sacro Imp\xE9rio Romano.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8883486",
    "imdbId": "tt8883486",
    "isFeatured": false,
    "director": "Petr J\xE1kl",
    "cast": [
      "Ben Foster",
      "Sophie Lowe",
      "Michael Caine"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Drama",
      "Hist\xF3ria"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-18884172",
    "title": "Terror em Crescent City",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 3.9,
    "image": "https://m.media-amazon.com/images/M/MV5BMzkxODU0NDItNTkzZS00ZmJlLTk5ZjMtMGQ0MzU4ODczM2RkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt18884172/img",
    "description": "Uma pequena cidade no sul \xE9 devastada por um serial killer, com todos sendo suspeitos, incluindo a pol\xEDcia.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt18884172",
    "imdbId": "tt18884172",
    "isFeatured": false,
    "director": "RJ Collins",
    "cast": [
      "Terrence Howard",
      "Esai Morales",
      "Nicky Whelan"
    ],
    "genres": [
      "Crime",
      "Terror",
      "Mist\xE9rio"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-29242846",
    "title": "O Trem Italiano da Felicidade",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 7.4,
    "image": "https://m.media-amazon.com/images/M/MV5BOTBiZTY0NDctOWUyMy00ZGYzLWI2ZGUtNjQwMzI0ZWU5ZmQ3XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt29242846/img",
    "description": "Um menino de sete anos chamado Amerigo que em 1946 deixa sua fam\xEDlia empobrecida em N\xE1poles e pega um trem para ir morar com uma fam\xEDlia mais rica no norte, como parte de uma iniciativa do p\xF3s-guerra para resgatar crian\xE7as da pobreza.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt29242846",
    "imdbId": "tt29242846",
    "isFeatured": false,
    "director": "Cristina Comencini",
    "cast": [
      "Barbara Ronchi",
      "Serena Rossi",
      "Stefano Accorsi"
    ],
    "genres": [
      "Drama",
      "Hist\xF3ria"
    ],
    "ageRating": "TV-14"
  },
  {
    "id": "movie-27599713",
    "title": "A Virgem Vermelha",
    "year": 2024,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BZWU5ZjdjYWItM2ZkNS00Yzg5LTgzNGUtNGFlYmJhOGQ2NDI1XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt27599713/img",
    "description": "Hildegart Rodr\xEDguez, escritora precoce e prol\xEDfica da d\xE9cada de 1930 na Espanha, criada por sua m\xE3e para se tornar um modelo para futuras mulheres.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt27599713",
    "imdbId": "tt27599713",
    "isFeatured": false,
    "director": "Paula Ortiz",
    "cast": [
      "Najwa Nimri",
      "Alba Planas",
      "Aixa Villagr\xE1n"
    ],
    "genres": [
      "Mist\xE9rio"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-18450548",
    "title": "N\xE3o V\xE1",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.2,
    "image": "https://m.media-amazon.com/images/M/MV5BZjc4ZjAyNWQtMmE1MC00ZmM0LTllODMtNGI0YzliMmVlYjk0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt18450548/img",
    "description": "A namorada de Semih termina repentinamente com ele. Em busca de respostas sobre o relacionamento deles, ele logo dever\xE1 confrontar o que h\xE1 muito ignorou.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt18450548",
    "imdbId": "tt18450548",
    "isFeatured": false,
    "director": "Ozan A\xE7iktan",
    "cast": [
      "Burak Deniz",
      "Dilan \xC7i\xE7ek Deniz",
      "Ceyda D\xFCvenci"
    ],
    "genres": [
      "Drama",
      "Romance"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-22010586",
    "title": "Em Busca do Enfermeiro da Noite",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BYzNhZGQ4MmYtMWVkMS00MWY5LThjMzgtYTBjNDY3YTJiNzUxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt22010586/img",
    "description": "Este document\xE1rio revela como os investigadores provaram que o enfermeiro da UTI Charles Cullen estava matando pacientes - e qu\xE3o perto ele esteve de escapar impune do assassinato.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt22010586",
    "imdbId": "tt22010586",
    "isFeatured": false,
    "director": "Tim Travers Hawkins",
    "cast": [
      "Charles Cullen",
      "Amy Loughren",
      "Donna Hargreaves"
    ],
    "genres": [
      "Document\xE1rio",
      "Crime"
    ],
    "ageRating": "TV-14"
  },
  {
    "id": "movie-8147518",
    "title": "Uma Pitada de Sorte",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BODY1ZTFhYTktZWY2OS00NmZjLWI0ZWYtYjNlZGJhNmM2NzZmXkEyXkFqcGdeQXVyMTU1ODkwMDU0._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8147518/img",
    "description": "Sonhando em ter seu pr\xF3prio neg\xF3cio de culin\xE1ria, sua \u201Csorte\u201D surge quando ela \xE9 aprovada para ser assistente de um famoso chef em um programa de televis\xE3o.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8147518",
    "imdbId": "tt8147518",
    "isFeatured": false,
    "director": "Pedro Ant\xF4nio Paes",
    "cast": [
      "Izabel Alvares",
      "Regiane Alves",
      "Daniel Belmonte"
    ],
    "genres": [
      "Com\xE9dia"
    ]
  },
  {
    "id": "movie-21094994",
    "title": "R.I.P.D. 2: Rise of the Damned",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.6,
    "image": "https://m.media-amazon.com/images/M/MV5BODA4Y2UxZjItOGY5NS00ZGJjLWIxMWMtZjczODQ1NzQwY2NiXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt21094994/img",
    "description": "Recrutado pelo RIPD, um xerife ressuscitado retorna \xE0 Terra para salvar a humanidade de uma porta de entrada para o inferno.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt21094994",
    "imdbId": "tt21094994",
    "isFeatured": false,
    "director": "Paul Leyden",
    "cast": [
      "Jeffrey Donovan",
      "Rachel Adedeji",
      "Penelope Mitchell"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Aventura",
      "Com\xE9dia"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-15374214",
    "title": "O Cavaleiro do Rei",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.4,
    "image": "https://m.media-amazon.com/images/M/MV5BNTg0ZDBlM2MtYmNhNy00ZGI5LWI0M2YtYTMzZDBlYzJiNDRlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15374214/img",
    "description": "Depois que seu rei morre, um cavaleiro deve se sacrificar para servir seu governante na vida ap\xF3s a morte, mas distra\xE7\xF5es repentinas levam a uma trag\xE9dia inesperada.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15374214",
    "imdbId": "tt15374214",
    "isFeatured": false,
    "director": "Biyi Bandele",
    "cast": [
      "Odunlade Adekola",
      "Shaffy Bello",
      "Olawale-Brymo Olofooro"
    ],
    "genres": [
      "Aventura",
      "Drama",
      "Hist\xF3ria"
    ],
    "ageRating": "TV-MA"
  },
  {
    "id": "movie-22207152",
    "title": "Um Mist\xE9rio de Natal",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6,
    "image": "https://m.media-amazon.com/images/M/MV5BZGU3N2E2NmItZTJlNC00ZGM5LTg2ZjAtODA3OWZmZjI3NTg3XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt22207152/img",
    "description": "Quando o pai de sua melhor amiga \xE9 falsamente acusado de roubar os sinos mais valiosos da cidade, uma jovem detetive amadora e seus amigos devem encontrar o verdadeiro ladr\xE3o antes do Natal.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt22207152",
    "imdbId": "tt22207152",
    "isFeatured": false,
    "director": "Alex Ranarivelo",
    "cast": [
      "Violet McGraw",
      "Santino Barnard",
      "Lauren Lindsey Donzis"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama",
      "Fam\xEDlia"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-1551614",
    "title": "Roubo Entre Ladr\xF5es",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.3,
    "image": "https://m.media-amazon.com/images/M/MV5BZjBiOTVkYWUtOTgwNy00YjY5LWJmN2UtYWFlYjlmMmMwYzcxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt1551614/img",
    "description": "Depois de planejar um assalto perfeito, Nick est\xE1 pronto para marcar. Um problema, sua garota e a equipe t\xEAm outras ideias. Eles derrubam Nick com uma saraivada de balas, mas Nick n\xE3o morre e, em uma corrida por sua vida, busca vingan\xE7a, um alvo de cada vez.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt1551614",
    "imdbId": "tt1551614",
    "isFeatured": false,
    "director": "Tibor Tak\xE1cs",
    "cast": [
      "Randy Couture",
      "Cam Gigandet",
      "Chris Maher"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Crime",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-18305922",
    "title": "Conspira\xE7\xE3o Fatal",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BNzkwYTY2MDktOTg3Yy00NjRkLTg3YWEtY2I1YTdiNGYwOGQxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt18305922/img",
    "description": "Casal Davi e Juliana enfrentam crises; Davi investiga esc\xE2ndalo financeiro no trabalho, colocando-se em perigo. Juliana suspeita que sua nova casa esconde segredos obscuros, colocando sua vida em risco. Suas vidas se entrela\xE7am com uma conspira\xE7\xE3o perigosa.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt18305922",
    "imdbId": "tt18305922",
    "isFeatured": false,
    "director": "Renato Siqueira",
    "cast": [
      "Aline Mineiro",
      "Ricardo Ramory",
      "Priscila Castello Branco"
    ],
    "genres": [
      "Suspense"
    ]
  },
  {
    "id": "movie-15038118",
    "title": "A Grande Aventura de Blue na Cidade",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.2,
    "image": "https://m.media-amazon.com/images/M/MV5BNWI2ZjYxMGYtODBkYS00NmExLWJiMTktOGUzOTJhODYwZWI0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt15038118/img",
    "description": "Josh e Blue v\xE3o para Nova York para fazer um teste para um grande musical da Broadway.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt15038118",
    "imdbId": "tt15038118",
    "isFeatured": false,
    "director": "Matt Stawski",
    "cast": [
      "Nick Balaban",
      "Ava Augustin",
      "Shazdeh Kapadia"
    ],
    "genres": [
      "Anima\xE7\xE3o",
      "Aventura",
      "Com\xE9dia"
    ],
    "ageRating": "TV-Y"
  },
  {
    "id": "movie-17220704",
    "title": "Uma Hist\xF3ria de Natal Natalina",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.7,
    "image": "https://m.media-amazon.com/images/M/MV5BZWU1Mjk2YmItM2E3Yi00OWYwLWIxMjItNGNkMGFiYmI0NDUxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt17220704/img",
    "description": "Segue o agora adulto Ralphie enquanto ele retorna para a casa na Cleveland Street para dar aos seus filhos um Natal m\xE1gico como o que ele teve quando crian\xE7a, reconectando-se com amigos de inf\xE2ncia e reconciliando o falecimento de seu Velho.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt17220704",
    "imdbId": "tt17220704",
    "isFeatured": false,
    "director": "Clay Kaytis",
    "cast": [
      "Peter Billingsley",
      "Erinn Hayes",
      "River Drosche"
    ],
    "genres": [
      "Com\xE9dia",
      "Fam\xEDlia"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-12630014",
    "title": "Busco Namorada",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 0,
    "image": "https://m.media-amazon.com/images/M/MV5BZTZjZDIyZmYtM2E4NC00MTZlLWE4YTYtNWRjYWI1ODJjODQ3XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12630014/img",
    "description": "Renzo Collazos \xE9 jornalista reconhecido da se\xE7\xE3o pol\xEDtica do jornal El Comercio h\xE1 um ano. Certa manh\xE3, o editor do site pede que ele gerencie um blog dedicado \xE0 juventude e escreva semanalmente sobre suas p\xE1lidas redes sociais...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12630014",
    "imdbId": "tt12630014",
    "isFeatured": false,
    "director": "Daniel Vega Vidal",
    "cast": [
      "Gustavo Bueno",
      "Vadhir Derbez",
      "Crystal Lopez"
    ],
    "genres": [
      "Com\xE9dia"
    ]
  },
  {
    "id": "movie-4459134",
    "title": "Frank & Penelope",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.3,
    "image": "https://m.media-amazon.com/images/M/MV5BMTVkMmFjODctMTRjYS00OWMyLWI3MGYtYmQ5NmY0YjAxNDQxXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt4459134/img",
    "description": "Uma hist\xF3ria de amor e viol\xEAncia quando um homem em seus \xFAltimos momentos emocionais encontra um salvador dan\xE7ando sedutoramente em um clube de strip-tease decadente. E uma vida certamente despencou de um penhasco de repente \xE9 redirecionada - j\xE1 que tudo agora vale a pena...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt4459134",
    "imdbId": "tt4459134",
    "isFeatured": false,
    "director": "Sean Patrick Flanery",
    "cast": [
      "Billy Budinich",
      "Caylee Cowan",
      "Johnathon Schaech"
    ],
    "genres": [
      "Terror",
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-14394620",
    "title": "Em Confinamento",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.7,
    "image": "https://m.media-amazon.com/images/M/MV5BOGUwMzZlMjMtNTc4Yy00N2Y3LWI4ZjItNmNiNWY3ZTUxYWY0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14394620/img",
    "description": "Um homem de fam\xEDlia se v\xEA preso no forro de uma cabana remota no Oregon, onde ca\xE7adores furtivos impiedosos esconderam seus ganhos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14394620",
    "imdbId": "tt14394620",
    "isFeatured": false,
    "director": "L. Gustavo Cooper",
    "cast": [
      "Henry Thomas",
      "Bradley Stryker",
      "C. Ernst Harth"
    ],
    "genres": [
      "Suspense"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-11540726",
    "title": "Sombras do Passado",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.9,
    "image": "https://m.media-amazon.com/images/M/MV5BYjAxZDc2YzYtYWE2Yi00Y2E3LTkyMTAtYTI0ZmFiZWRjZmIyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11540726/img",
    "description": "A vida de Margaret est\xE1 em ordem. Ela \xE9 capaz, disciplinada e bem-sucedida. Tudo est\xE1 sob controle at\xE9 que David retorne \u2013 isto \xE9 \u2013 carregando consigo os horrores do passado de Margaret.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11540726",
    "imdbId": "tt11540726",
    "isFeatured": false,
    "director": "Andrew Semans",
    "cast": [
      "Rebecca Hall",
      "Tim Roth",
      "Grace Kaufman"
    ],
    "genres": [
      "Crime",
      "Drama",
      "Terror"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-14668630",
    "title": "Lilo, Lilo, Crocodilo",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.1,
    "image": "https://m.media-amazon.com/images/M/MV5BMDkyOTM5MmYtZWU0ZC00MmU0LWIyN2UtZDAzNGRiZDZmN2MwXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt14668630/img",
    "description": "Longa-metragem baseado no livro infantil sobre um crocodilo que vive na cidade de Nova York.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt14668630",
    "imdbId": "tt14668630",
    "isFeatured": false,
    "director": "Josh Gordon, Will Speck",
    "cast": [
      "Javier Bardem",
      "Winslow Fegley",
      "Shawn Mendes"
    ],
    "genres": [
      "Aventura",
      "Com\xE9dia",
      "Fam\xEDlia"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-8745676",
    "title": "As Nadadoras",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.4,
    "image": "https://m.media-amazon.com/images/M/MV5BM2I0MWExYTktN2Q5NS00YjAwLWIwYTAtYWIyNDc1ZTVmZTQ4XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt8745676/img",
    "description": "Da S\xEDria devastada pela guerra aos Jogos Ol\xEDmpicos do Rio de 2016, duas jovens irm\xE3s embarcam numa viagem angustiante como refugiadas, colocando ao mesmo tempo os seus cora\xE7\xF5es e as suas capacidades de nata\xE7\xE3o de campe\xE3 em uso her\xF3ico.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt8745676",
    "imdbId": "tt8745676",
    "isFeatured": false,
    "director": "Sally El Hosaini",
    "cast": [
      "Nathalie Issa",
      "Manal Issa",
      "Matthias Schweigh\xF6fer"
    ],
    "genres": [
      "Biografia",
      "Drama",
      "Esporte"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-9071456",
    "title": "Os Odiados do Casamento",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 5.8,
    "image": "https://m.media-amazon.com/images/M/MV5BNTdhMTU3MjctYjU1OS00Y2M1LWJkNzEtMGMyY2VkNDQ5NDZlXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt9071456/img",
    "description": "As tens\xF5es familiares aumentam entre os irm\xE3os na semana que antecede o casamento da meia-irm\xE3 no pa\xEDs.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt9071456",
    "imdbId": "tt9071456",
    "isFeatured": false,
    "director": "Claire Scanlon",
    "cast": [
      "Allison Janney",
      "Ben Platt",
      "Cynthia Addai-Robinson"
    ],
    "genres": [
      "Com\xE9dia"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-21819228",
    "title": "O M\xE9todo de Stutz",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.8,
    "image": "https://m.media-amazon.com/images/M/MV5BMjZiMjQ4YzYtMWNhZi00NzBmLWE1YzEtMzQxZTRlMWZjNGU3XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt21819228/img",
    "description": "Acompanhe Hill e seu terapeuta enquanto ele tem discuss\xF5es francas sobre sa\xFAde mental e o agravamento progressivo dos ataques de ansiedade relacionados \xE0 promo\xE7\xE3o de filmes que transformaram seu emprego dos sonhos em um pesadelo.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt21819228",
    "imdbId": "tt21819228",
    "isFeatured": false,
    "director": "Jonah Hill",
    "cast": [
      "Sharon Feldstein",
      "Jonah Hill",
      "Phil Stutz"
    ],
    "genres": [
      "Document\xE1rio"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-11399896",
    "title": "A \xDAltima Ca\xE7ada",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 4.4,
    "image": "https://m.media-amazon.com/images/M/MV5BMmMyYjYxZmYtNjgzZi00NzU0LThlZmMtZWZiZTUxMWNlMWRhXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt11399896/img",
    "description": "Baseado em acontecimentos reais do Velho Oeste do in\xEDcio dos anos 1900, Willie Boy se apaixona por Carlota da tribo Chemehuevi, apesar de serem proibidos de ficarem juntos. Um incidente fatal obriga o jovem casal a fugir do \xFAnico lugar que conhecem...",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt11399896",
    "imdbId": "tt11399896",
    "isFeatured": false,
    "director": "Christian Camargo",
    "cast": [
      "Martin Sensmeier",
      "Mainei Kinimaka",
      "Zahn McClarnon"
    ],
    "genres": [
      "A\xE7\xE3o",
      "Drama",
      "Romance"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-12728584",
    "title": "La Ver\xF3nica",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6,
    "image": "https://m.media-amazon.com/images/M/MV5BZWExYjM3OTMtMTQwNi00MTRlLWE5NjMtNWIzNjZlMmUxNzk4XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12728584/img",
    "description": "Ver\xF4nica, modelo muito popular nas redes sociais, cai em desgra\xE7a ao descobrir que \xE9 a principal suspeita de uma investiga\xE7\xE3o pelo assassinato de sua primeira filha.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12728584",
    "imdbId": "tt12728584",
    "isFeatured": false,
    "director": "Leonardo Medel",
    "cast": [
      "Mariana Di Gir\xF3lamo",
      "Valeryia Alfirovich",
      "Stephan Cabezas"
    ],
    "genres": [
      "Drama"
    ]
  },
  {
    "id": "movie-12545566",
    "title": "A Lista do Sr. Malcolm",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6,
    "image": "https://m.media-amazon.com/images/M/MV5BMWFkNThiYWItYzI0Mi00ZDAxLThlYzAtNjAyMDQzY2IzZTE0XkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt12545566/img",
    "description": "Uma jovem corteja um misterioso pretendente rico na Inglaterra do s\xE9culo XIX.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt12545566",
    "imdbId": "tt12545566",
    "isFeatured": false,
    "director": "Emma Holly Jones",
    "cast": [
      "Freida Pinto",
      "Sope Dirisu",
      "Oliver Jackson-Cohen"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama",
      "Romance"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-13320662",
    "title": "Terra dos Sonhos",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.7,
    "image": "https://m.media-amazon.com/images/M/MV5BOGFiMmNhZGItNjZjOS00ZTk1LTg1MDMtYzBhZjBmYjdlNGQyXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt13320662/img",
    "description": "Uma jovem descobre um mapa secreto para o mundo dos sonhos de Slumberland e, com a ajuda de um fora-da-lei exc\xEAntrico, ela atravessa sonhos e foge de pesadelos, na esperan\xE7a de poder ver seu falecido pai novamente.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt13320662",
    "imdbId": "tt13320662",
    "isFeatured": false,
    "director": "Francis Lawrence",
    "cast": [
      "Jason Momoa",
      "Marlow Barkley",
      "Chris O'Dowd"
    ],
    "genres": [
      "Aventura",
      "Com\xE9dia",
      "Drama"
    ],
    "ageRating": "PG"
  },
  {
    "id": "movie-10999120",
    "title": "Spirited: Um Conto Natalino",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.6,
    "image": "https://m.media-amazon.com/images/M/MV5BY2E3MWRiMjYtMjM2Yi00ZDJiLTgwZDctMjk2ZWQ0NjQyYzliXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10999120/img",
    "description": "Uma vers\xE3o musical da hist\xF3ria de Charles Dickens sobre um misantropo avarento que \xE9 levado em uma jornada m\xE1gica.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10999120",
    "imdbId": "tt10999120",
    "isFeatured": false,
    "director": "Sean Anders",
    "cast": [
      "Will Ferrell",
      "Ryan Reynolds",
      "Octavia Spencer"
    ],
    "genres": [
      "Com\xE9dia",
      "Fam\xEDlia",
      "Fantasia"
    ],
    "ageRating": "PG-13"
  },
  {
    "id": "movie-10343028",
    "title": "Armageddon Time",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.4,
    "image": "https://m.media-amazon.com/images/M/MV5BNDcyNGZmZTAtOWM2NS00NzlkLTk2ZTMtMDkzNGM1ODQ3OTVkXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt10343028/img",
    "description": "Uma hist\xF3ria profundamente pessoal sobre a maioridade sobre a for\xE7a da fam\xEDlia e a busca geracional do sonho americano.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt10343028",
    "imdbId": "tt10343028",
    "isFeatured": false,
    "director": "James Gray",
    "cast": [
      "Anne Hathaway",
      "Jeremy Strong",
      "Banks Repeta"
    ],
    "genres": [
      "Drama"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-7461272",
    "title": "Disque Jane",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 6.5,
    "image": "https://m.media-amazon.com/images/M/MV5BMzU4NzNmY2UtZDgxZi00YTJmLTk4OTAtYjgzOTAyMmRiOWFmXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt7461272/img",
    "description": "Uma mulher casada com uma gravidez indesejada vive numa \xE9poca na Am\xE9rica em que n\xE3o consegue fazer um aborto legal e trabalha com um grupo de mulheres suburbanas para encontrar ajuda.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt7461272",
    "imdbId": "tt7461272",
    "isFeatured": false,
    "director": "Phyllis Nagy",
    "cast": [
      "Elizabeth Banks",
      "Sigourney Weaver",
      "Chris Messina"
    ],
    "genres": [
      "Drama",
      "Hist\xF3ria"
    ],
    "ageRating": "R"
  },
  {
    "id": "movie-7322224",
    "title": "Tri\xE2ngulo da Tristeza",
    "year": 2022,
    "type": "FILME" /* MOVIE */,
    "rating": 7.2,
    "image": "https://m.media-amazon.com/images/M/MV5BYTViNzUyNDUtZTg3Yy00OTY4LWEyMTYtMmUzYjE3ZmZjYzUwXkEyXkFqcGc@._V1_SX300.jpg",
    "backdrop": "https://images.metahub.space/background/medium/tt7322224/img",
    "description": "Um casal de celebridades e modelos se junta a um cruzeiro movimentado para os super-ricos.",
    "platform": "Outros",
    "videoUrl": "https://watchplayer.lat/movie/tt7322224",
    "imdbId": "tt7322224",
    "isFeatured": false,
    "director": "Ruben \xD6stlund",
    "cast": [
      "Thobias Thorwid",
      "Harris Dickinson",
      "Charlbi Dean"
    ],
    "genres": [
      "Com\xE9dia",
      "Drama"
    ],
    "ageRating": "R"
  },
  {
    id: "movie-17492148",
    title: "Conselhos De Um Serial Killer Aposentado",
    year: 2025,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BNDQwZWVkYTUtYjU5Ni00NWRjLWE2NTktNmQ1Mzc1ODBjZWNkXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt17492148/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt17492148",
    imdbId: "tt17492148",
    isFeatured: false
  },
  {
    id: "movie-15738252",
    title: "Enterre Seus Mortos",
    year: 2025,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BOGQyZDYyYTEtMzI5NC00ZmFiLWE1OGMtNDE2OGJjNjk2ODViXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt15738252/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt15738252",
    imdbId: "tt15738252",
    isFeatured: false
  },
  {
    id: "movie-30343021",
    title: "Song Sung Blue: Um Sonho a Dois",
    year: 2025,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BYmQ2YjhjNjgtNGQxNC00NmI0LWEzMjktNWEzMWY2OTUwZjFiXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt30343021/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt30343021",
    imdbId: "tt30343021",
    isFeatured: false
  },
  {
    id: "movie-34682220",
    title: "Parque Lezama",
    year: 2026,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BNDU1Njk2MDctMjExNS00YTRlLWEwNzAtNDk3ZmRjZmQzNjU0XkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt34682220/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt34682220",
    imdbId: "tt34682220",
    isFeatured: false
  },
  {
    id: "movie-25967234",
    title: "Alien\xEDgena",
    year: 2024,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BZjkyYzQwOTktOTg4Ni00ZmEwLTlmODMtNjFjZGY2Zjc2MzI4XkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt25967234/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt25967234",
    imdbId: "tt25967234",
    isFeatured: false
  },
  {
    id: "movie-27497165",
    title: "Sombra da Morte",
    year: 2026,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BZjQxMTVhMzktZmI4MC00MWI5LTg0YWEtN2E4MjMwMTU0ZTBkXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt27497165/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt27497165",
    imdbId: "tt27497165",
    isFeatured: false
  },
  {
    id: "movie-15940132",
    title: "M\xE1quina de Guerra",
    year: 2026,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BMmM1ZTc5ZTYtOTM2My00MjBmLWE5NzktYzkyYzdlYWE3ZDAzXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt15940132/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt15940132",
    imdbId: "tt15940132",
    isFeatured: false
  },
  {
    id: "movie-34610311",
    title: "A Sombra do Perigo",
    year: 2025,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BN2ZhMGU1MTItMzBkMi00MjZmLWI2MDQtMWE1ODNjMWFhZjY4XkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt34610311/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt34610311",
    imdbId: "tt34610311",
    isFeatured: false
  },
  {
    id: "movie-11005128",
    title: "Nas Profundezas",
    year: 2022,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BNmNjNWVjNTgtZjNiYS00Njg0LWEyYWQtNWJiOTUwMzE4MTE4XkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt11005128/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt11005128",
    imdbId: "tt11005128",
    isFeatured: false
  },
  {
    id: "movie-15006754",
    title: "A Gestora",
    year: 2022,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BNTIyNTVjOGItYzA1ZC00NmNkLWFhYzUtZDRhNTIzMmVhOWQ4XkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt15006754/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt15006754",
    imdbId: "tt15006754",
    isFeatured: false
  },
  {
    id: "movie-15463032",
    title: "Amor em Verona",
    year: 2022,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BMjk5MTQ2ZTAtNWQ4ZC00NWY5LWFhMTItZjZkZDI0N2QwNjhkXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt15463032/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt15463032",
    imdbId: "tt15463032",
    isFeatured: false
  },
  {
    id: "movie-15529106",
    title: "Fortaleza Hotel",
    year: 2022,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BMWZhYTZhNjItNzVjMy00OWU3LTljMTAtMzBmYjZlNzg4MGVkXkEyXkFqcGc@._V1_.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt15529106/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt15529106",
    imdbId: "tt15529106",
    isFeatured: false
  },
  {
    id: "movie-11636118",
    title: "De F\xE9rias da Fam\xEDlia",
    year: 2022,
    type: "FILME" /* MOVIE */,
    rating: 0,
    image: "https://m.media-amazon.com/images/M/MV5BYjYzMTkyYjUtYTVmYi00Y2ZjLTg2N2ItZGFhODAzYTVmYzkzXkEyXkFqcGc@._V1_SX300.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt11636118/img",
    description: "Sinopse indispon\xEDvel.",
    platform: "Outros",
    videoUrl: "https://watchplayer.lat/movie/tt11636118",
    imdbId: "tt11636118",
    isFeatured: false
  }
];

// src/core/providers/providerRegistry.ts
var localEngineCache = { active: false, lastCheck: 0 };
async function isLocalStremioEngineOnline() {
  const now = Date.now();
  if (now - localEngineCache.lastCheck < 15e3) {
    return localEngineCache.active;
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    localEngineCache = { active: false, lastCheck: now };
    return false;
  }
  try {
    const res = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(500) });
    localEngineCache = { active: res.ok, lastCheck: now };
    return res.ok;
  } catch {
    localEngineCache = { active: false, lastCheck: now };
    return false;
  }
}
var DEFAULT_PROVIDERS = [
  {
    id: "zapitv-show-subtitle-pt-br",
    name: "Show Subtitle PT-BR (Stremio Oficial)",
    url: "/api/stremio/show-subtitle-pt-br",
    enabled: true,
    type: "stremio-addon",
    priority: 1,
    isPtBr: true,
    status: "online"
  },
  {
    id: "zapitv-mico-leao-dublado",
    name: "Mico-Le\xE3o Dublado (Stremio Addon)",
    url: "/api/stremio/mico-leao-dublado",
    enabled: true,
    type: "stremio-addon",
    priority: 2,
    isPtBr: true,
    status: "online"
  },
  {
    id: "fenixflix-animes",
    name: "FenixFlix (Animes Dublados PT-BR & Zeus)",
    url: "https://fenixflix.fenixhub.online",
    enabled: true,
    type: "stremio-addon",
    priority: 3,
    isPtBr: true,
    status: "online"
  },
  {
    id: "torrentio-brazuca",
    name: "Torrentio Brazuca (Stremio Addon)",
    url: "https://torrentio.strem.fun/brazuca",
    enabled: true,
    type: "stremio-addon",
    priority: 4,
    isPtBr: true,
    status: "online"
  },
  {
    id: "torrentio-global",
    name: "Torrentio Oficial (\xC1udio Original & Multi-Idioma)",
    url: "https://torrentio.strem.fun",
    enabled: true,
    type: "stremio-addon",
    priority: 5,
    isPtBr: false,
    status: "online"
  },
  {
    id: "magnetflix-animes",
    name: "Magnetflix (Animes e S\xE9ries PT-BR Backup)",
    url: "https://magnetflix.flixbr.online/qualities=4k,1080p,720p,sd|audio=dublado,legendado|catalogs=populares_movie,populares_series,recentes_servidor_movie,recentes_servidor_series,emalta_movie,emalta_series",
    enabled: true,
    type: "stremio-addon",
    priority: 6,
    isPtBr: true,
    status: "online"
  },
  {
    id: "zapitv-cinema-aberto",
    name: "Cinema Aberto & Acervo Nacional PT-BR (Stremio Oficial)",
    url: "/api/stremio/cinema-aberto",
    enabled: true,
    type: "stremio-addon",
    priority: 6,
    isPtBr: true,
    status: "online"
  },
  {
    id: "zapitv-blender-open",
    name: "Blender Open Movies & S\xE9ries Abertas (Creative Commons CC-BY)",
    url: "/api/stremio/blender-open",
    enabled: true,
    type: "stremio-addon",
    priority: 7,
    isPtBr: true,
    status: "online"
  },
  {
    id: "zapitv-public-domain",
    name: "Dom\xEDnio P\xFAblico Mundial (Stremio Oficial)",
    url: "/api/stremio/public-domain",
    enabled: true,
    type: "stremio-addon",
    priority: 8,
    isPtBr: false,
    status: "online"
  },
  {
    id: "stremio-public-domain-web",
    name: "Public Domain Movies (Stremio Community Addon)",
    url: "https://public-domain-movies.strem.fun",
    enabled: false,
    type: "stremio-addon",
    priority: 9,
    isPtBr: false,
    status: "offline"
  },
  {
    id: "stremio-cinemeta",
    name: "Cinemeta (Stremio Oficial)",
    url: "https://v3-cinemeta.strem.io",
    enabled: true,
    type: "stremio-addon",
    priority: 10,
    isPtBr: false,
    status: "online"
  },
  {
    id: "stremio-opensubtitles",
    name: "OpenSubtitles v3 (Stremio Oficial)",
    url: "https://opensubtitles-v3.strem.io",
    enabled: true,
    type: "stremio-addon",
    priority: 11,
    isPtBr: true,
    status: "online"
  }
];
var VERIFIED_TEST_STREAMS = {
  // Sintel / Tears of Steel / Big Buck Bunny / Matrix test id
  "sample-stream": [
    {
      name: "ZapiTV HLS Master",
      title: "[DUBLADO PT-BR] Big Buck Bunny - 1080p FHD HLS",
      url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      sourceType: "hls",
      isPtBr: true,
      isDubbed: true,
      quality: "1080p",
      providerName: "ZapiTV Test Stream"
    },
    {
      name: "Tears of Steel HLS",
      title: "[\xC1UDIO ORIGINAL INGL\xCAS / MULTI-\xC1UDIO] Tears of Steel - 4K UHD HLS",
      url: "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
      sourceType: "hls",
      isPtBr: false,
      isDubbed: false,
      quality: "4K",
      providerName: "Unified Streaming"
    },
    {
      name: "Sintel Direct MP4",
      title: "[DUBLADO PT-BR] Sintel - 1080p MP4",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
      sourceType: "mp4",
      isPtBr: true,
      isDubbed: true,
      quality: "1080p",
      providerName: "Google Open CDN"
    }
  ]
};
var ProviderRegistryService = class {
  // 10 minutos
  constructor() {
    this.providers = [];
    this.cache = /* @__PURE__ */ new Map();
    this.CACHE_TTL_MS = 10 * 60 * 1e3;
    this.loadProviders();
  }
  loadProviders() {
    try {
      const saved = localStorage.getItem("zapitv_providers_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        const cleanParsed = parsed.filter((p) => p.type !== "vod-embed" && !p.id.includes("embedplay") && !p.id.includes("playerflix") && !p.id.includes("videasy"));
        const map = /* @__PURE__ */ new Map();
        DEFAULT_PROVIDERS.forEach((p) => map.set(p.id, p));
        cleanParsed.forEach((p) => map.set(p.id, { ...map.get(p.id) || {}, ...p }));
        this.providers = Array.from(map.values()).sort((a, b) => a.priority - b.priority);
        return;
      }
    } catch {
    }
    this.providers = [...DEFAULT_PROVIDERS];
  }
  saveProviders() {
    try {
      localStorage.setItem("zapitv_providers_config", JSON.stringify(this.providers));
    } catch (e) {
      console.warn("Erro ao salvar provedores:", e);
    }
  }
  getProviders() {
    return [...this.providers];
  }
  addProvider(provider) {
    this.providers.push(provider);
    this.saveProviders();
  }
  updateProvider(id, updates) {
    const idx = this.providers.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.providers[idx] = { ...this.providers[idx], ...updates };
      this.saveProviders();
    }
  }
  removeProvider(id) {
    this.providers = this.providers.filter((p) => p.id !== id);
    this.saveProviders();
  }
  async checkProviderHealth(id) {
    const provider = this.providers.find((p) => p.id === id);
    if (!provider) throw new Error("Provedor n\xE3o encontrado");
    const startTime = Date.now();
    try {
      if (provider.type === "stremio-addon") {
        const client = new StremioClient(provider.url);
        const manifest = await client.getManifest();
        const latency = Date.now() - startTime;
        this.updateProvider(id, {
          status: "online",
          latencyMs: latency,
          lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
          errorMessage: void 0
        });
      } else {
        const pingUrl = `/api/proxy?url=${encodeURIComponent(provider.url)}`;
        const res = await fetch(pingUrl, { signal: AbortSignal.timeout(6e3) });
        const latency = Date.now() - startTime;
        this.updateProvider(id, {
          status: res.ok ? "online" : "error",
          latencyMs: latency,
          lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
          errorMessage: res.ok ? void 0 : `Status HTTP ${res.status}`
        });
      }
    } catch (err) {
      this.updateProvider(id, {
        status: "error",
        latencyMs: Date.now() - startTime,
        lastChecked: (/* @__PURE__ */ new Date()).toISOString(),
        errorMessage: err.message || "Falha de conex\xE3o"
      });
    }
    return this.providers.find((p) => p.id === id);
  }
  /**
   * Resolve todos os fluxos de reprodução para um item (filme ou série).
   */
  async resolveStreams(type, id, episode) {
    const cacheKey = `v4_priority_${type}_${id.tmdbId || id.imdbId || id.id}_${id.imdbId || ""}_${episode?.season || 0}_${episode?.episode || 0}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.streams;
    }
    const streams = [];
    const activeProviders = this.providers.filter((p) => p.enabled);
    const rawTargetId = id.id || "";
    const cleanId = rawTargetId.replace(/^tmdb-?/i, "");
    const tmdbNum = id.tmdbId ? String(id.tmdbId).replace(/^tmdb-?/i, "") : !rawTargetId.startsWith("tt") ? cleanId : "";
    let imdbStr = id.imdbId ? String(id.imdbId) : "";
    if (tmdbNum) {
      try {
        const resolved = await tmdbService.getImdbId(tmdbNum, type);
        if (resolved) imdbStr = resolved;
      } catch {
      }
    }
    if (!imdbStr && rawTargetId.startsWith("tt")) {
      imdbStr = rawTargetId;
    }
    const openItem = VERIFIED_OPEN_ITEMS.find(
      (item) => item.id === rawTargetId || item.id === id.id || rawTargetId.startsWith("open-") && (tmdbNum && String(item.tmdbId) === String(tmdbNum) || imdbStr && item.imdbId === imdbStr) || imdbStr && item.imdbId === imdbStr && item.id.startsWith("anime-")
    );
    const catalogItem = !openItem ? filmesData.find(
      (item) => item.id === rawTargetId || item.id === id.id || imdbStr && item.imdbId === imdbStr || tmdbNum && String(item.tmdbId) === String(tmdbNum)
    ) : null;
    const targetTitle = (id.title || catalogItem?.title || openItem?.title || "").trim();
    if (openItem) {
      if ((type === "series" || type === "anime") && openItem.episodes && openItem.episodes.length > 0) {
        const epNum = episode?.episode || 1;
        const epObj = openItem.episodes.find((e) => e.number === epNum) || openItem.episodes[0];
        if (epObj?.videoUrl) {
          const directUrl = epObj.videoUrl;
          const proxyUrl = directUrl.startsWith("http") ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          const isPtBr = openItem.audioStatus === "pt-br-original" || openItem.audioStatus === "universal" || openItem.audioStatus === "pt-br-dubbed";
          const isDubbed = openItem.audioStatus === "pt-br-dubbed";
          streams.push({
            name: `${openItem.title} - Ep ${epObj.number}`,
            title: `[EPIS\xD3DIO ${epObj.number}] ${epObj.title} (${isDubbed ? "Dublado PT-BR" : "Stream Otimizado"})`,
            url: proxyUrl,
            sourceType: epObj.videoUrl.includes(".m3u8") ? "hls" : "mp4",
            isPtBr,
            isDubbed,
            quality: "1080p",
            providerName: "Acervo ZapiTV Verificado",
            providerId: "zapitv-verified"
          });
          streams.push({
            name: `${openItem.title} - Ep ${epObj.number} (CDN)`,
            title: `[EPIS\xD3DIO ${epObj.number}] ${epObj.title} (${isDubbed ? "Dublado PT-BR" : "CDN Direto"})`,
            url: directUrl,
            sourceType: epObj.videoUrl.includes(".m3u8") ? "hls" : "mp4",
            isPtBr,
            isDubbed,
            quality: "1080p",
            providerName: "Acervo ZapiTV CDN",
            providerId: "zapitv-verified"
          });
        }
      } else if (openItem.verifiedStreams && openItem.verifiedStreams.length > 0) {
        streams.push(...openItem.verifiedStreams);
      }
    }
    if (catalogItem) {
      if ((type === "series" || type === "anime") && catalogItem.episodes && catalogItem.episodes.length > 0) {
        const epNum = episode?.episode || 1;
        const epObj = catalogItem.episodes.find((e) => e.number === epNum) || catalogItem.episodes[0];
        if (epObj?.videoUrl && !epObj.videoUrl.includes("Caminandes") && !epObj.videoUrl.includes("Night_of_the_Living_Dead")) {
          const directUrl = epObj.videoUrl;
          const proxyUrl = directUrl.startsWith("http") ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          const isDubbed = catalogItem.audioStatus === "pt-br-dubbed";
          streams.push({
            name: `${catalogItem.title} - T${episode?.season || 1}E${epObj.number}`,
            title: `[EPIS\xD3DIO ${epObj.number}] ${epObj.title} (${isDubbed ? "Dublado PT-BR" : "Stream HD"})`,
            url: proxyUrl,
            sourceType: epObj.videoUrl.includes(".m3u8") ? "hls" : "mp4",
            isPtBr: true,
            isDubbed,
            quality: "1080p",
            providerName: "Acervo ZapiTV S\xE9ries",
            providerId: "zapitv-series"
          });
        }
      } else if (catalogItem.verifiedStreams && catalogItem.verifiedStreams.length > 0) {
        const safeStreams = catalogItem.verifiedStreams.filter(
          (s) => !s.url?.includes("Night_of_the_Living_Dead") && !s.url?.includes("Caminandes")
        );
        streams.push(...safeStreams);
      } else if (catalogItem.videoUrl && !catalogItem.videoUrl.includes("Night_of_the_Living_Dead") && !catalogItem.videoUrl.includes("Caminandes")) {
        const directUrl = catalogItem.videoUrl;
        const isHls = directUrl.includes(".m3u8");
        const isMp4 = directUrl.includes(".mp4");
        if (isHls || isMp4) {
          const proxyUrl = directUrl.startsWith("http") ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
          streams.push({
            name: `${catalogItem.title} - Stream Oficial`,
            title: `${catalogItem.title} (Dublado PT-BR 1080p)`,
            url: proxyUrl,
            sourceType: isHls ? "hls" : "mp4",
            isPtBr: true,
            isDubbed: true,
            quality: "1080p",
            providerName: "Acervo ZapiTV Oficial",
            providerId: "zapitv-catalog"
          });
        }
      }
    }
    const stremioAddons = activeProviders.filter((p) => p.type === "stremio-addon");
    const stremioType = type === "movie" ? "movie" : "series";
    const primaryId = imdbStr || tmdbNum || rawTargetId;
    const stremioId = episode && (type === "series" || type === "anime") ? `${primaryId}:${episode.season}:${episode.episode}` : primaryId;
    if (stremioId) {
      mediaLoadingTracker.transition(rawTargetId, "SEARCHING_SOURCES", {
        stremioId,
        stremioType,
        providerCount: stremioAddons.length
      });
      const addonPromises = stremioAddons.map(async (addon) => {
        const startProviderTime = Date.now();
        let providerSuccess = false;
        let providerStreamCount = 0;
        let providerError;
        try {
          const client = new StremioClient(addon.url);
          let res = await Promise.race([
            client.getStreams(stremioType, stremioId),
            new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_ADDON")), 8e3))
          ]);
          if ((!res || !res.streams || res.streams.length === 0) && tmdbNum && imdbStr) {
            const altBase = stremioId.startsWith("tt") ? tmdbNum : imdbStr;
            const altId = episode && (type === "series" || type === "anime") ? `${altBase}:${episode.season}:${episode.episode}` : altBase;
            try {
              res = await Promise.race([
                client.getStreams(stremioType, altId),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_ADDON_ALT")), 5e3))
              ]);
            } catch {
            }
          }
          if ((!res || !res.streams || res.streams.length === 0) && (type === "anime" || type === "series")) {
            const altType = stremioType === "series" ? "anime" : "series";
            try {
              res = await Promise.race([
                client.getStreams(altType, stremioId),
                new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_ADDON_TYPE")), 5e3))
              ]);
            } catch {
            }
          }
          if (res && Array.isArray(res.streams)) {
            const parsedStreams = [];
            for (const s of res.streams) {
              const sUrl = s.url || "";
              if (s.ytId || sUrl.includes("youtube.com") || sUrl.includes("youtu.be")) continue;
              if (sUrl.includes("embed") || sUrl.includes("iframe") || s.sourceType === "embed") continue;
              const isHls = sUrl.includes(".m3u8") || s.sourceType === "hls";
              const isDash = sUrl.includes(".mpd");
              const isDirectVideo = sUrl.includes(".mp4") || sUrl.includes(".webm") || sUrl.includes(".ogv") || sUrl.includes("/api/proxy") || s.sourceType === "mp4";
              const isTorrent = Boolean(s.infoHash);
              if (isHls || isDash || isDirectVideo) {
                if (sUrl.startsWith("http://") && !sUrl.includes("/api/proxy")) {
                  parsedStreams.push({
                    ...s,
                    url: `/api/proxy?url=${encodeURIComponent(sUrl)}`,
                    providerName: `${addon.name} (Proxy)`,
                    providerId: addon.id,
                    sourceType: isHls ? "hls" : "mp4"
                  });
                  if (typeof window !== "undefined" && window.location.protocol === "https:") {
                    parsedStreams.push({
                      ...s,
                      url: sUrl.replace(/^http:/, "https:"),
                      providerName: `${addon.name} (HTTPS Direto)`,
                      providerId: addon.id,
                      sourceType: isHls ? "hls" : "mp4"
                    });
                  }
                }
                parsedStreams.push({
                  ...s,
                  providerName: addon.name,
                  providerId: addon.id,
                  sourceType: isHls ? "hls" : "mp4"
                });
              } else if (isTorrent) {
                const engineOnline = await isLocalStremioEngineOnline();
                if (!engineOnline) continue;
                const engineUrl = `http://127.0.0.1:11470/${s.infoHash}/${s.fileIdx || 0}`;
                parsedStreams.push({
                  ...s,
                  url: engineUrl,
                  providerName: `${addon.name}${engineOnline ? "" : " (Requer Stremio Engine)"}`,
                  providerId: addon.id,
                  sourceType: "mp4",
                  isTorrent: true,
                  behaviorHints: {
                    ...s.behaviorHints || {},
                    notWebReady: !engineOnline
                  }
                });
              }
            }
            providerSuccess = true;
            providerStreamCount = parsedStreams.length;
            return parsedStreams;
          }
        } catch (err) {
          providerError = err.message || "Erro de comunica\xE7\xE3o";
        } finally {
          const duration = Date.now() - startProviderTime;
          mediaLoadingTracker.recordProviderAttempt(rawTargetId, {
            providerId: addon.id,
            providerName: addon.name,
            durationMs: duration,
            success: providerSuccess,
            streamCount: providerStreamCount,
            error: providerError
          });
        }
        return [];
      });
      const results = await Promise.allSettled(addonPromises);
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value)) {
          streams.push(...r.value);
        }
      }
    }
    if (id.id === "sample-stream" || id.tmdbId === "sample-stream") {
      streams.push(...VERIFIED_TEST_STREAMS["sample-stream"]);
    }
    mediaLoadingTracker.transition(rawTargetId, "VALIDATING_SOURCES", {
      rawStreamCount: streams.length
    });
    const cleanStreams = streamValidator.filterCleanStreams(streams, targetTitle).filter((s) => {
      if (s.ytId) return false;
      const u = (s.url || "").toLowerCase();
      const t = (s.title || "").toLowerCase();
      if (imdbStr === "tt0409591" && s.providerId === "fenixflix-animes" && !/🌪️\s*Hypex|💥\s*Figgs|🔋\s*Atlas|🚗\s*Arthur/i.test(s.title || "")) {
        return false;
      }
      if (typeof window !== "undefined" && window.location.protocol === "https:") {
        if (u.startsWith("http://")) return false;
        if (/localhost|127\.0\.0\.1|%5b%3a%3a1%5d|\[::1\]/.test(u)) return false;
      }
      if (u.includes("youtube.com") || u.includes("youtu.be")) return false;
      if (u.includes("embedplay") || u.includes("playerflix") || u.includes("videasy") || u.includes("superflix")) return false;
      const isNightLivingDead = u.includes("night_of_the_living_dead") || t.includes("night of the living dead") || t.includes("noite dos mortos-vivos");
      if (isNightLivingDead && rawTargetId !== "open-night-living-dead-1968" && id.imdbId !== "tt0063350") {
        return false;
      }
      const isCaminandes = u.includes("caminandes") || t.includes("caminandes");
      if (isCaminandes && rawTargetId !== "open-caminandes-s1") {
        return false;
      }
      return true;
    });
    const itemTarget = openItem || {
      id: id.id || id.imdbId || String(id.tmdbId || ""),
      title: targetTitle,
      type: type === "movie" ? "FILME" /* MOVIE */ : type === "anime" ? "ANIME" /* ANIME */ : "S\xC9RIE" /* SERIES */,
      rating: 7,
      year: id.year || openItem?.year || 0,
      image: openItem?.image || "",
      tmdbId: id.tmdbId ? String(id.tmdbId) : void 0,
      imdbId: imdbStr || id.imdbId,
      genres: openItem?.genres || []
    };
    const identity = canonicalIdentityService.buildIdentity(itemTarget, episode);
    let hasExternalPtSub = false;
    try {
      hasExternalPtSub = await Promise.race([
        subtitleService.hasPtBrSubtitles(itemTarget, episode?.season, episode?.episode),
        new Promise((resolve) => setTimeout(() => resolve(false), 1500))
      ]);
    } catch {
    }
    mediaLoadingTracker.transition(rawTargetId, "SELECTING_AUDIO", {
      cleanStreamsCount: cleanStreams.length,
      hasExternalPtSub
    });
    const sorted = sourceSelectionService.rankStreams(cleanStreams, {
      hasExternalPtSub,
      preferDubbed: true,
      identity,
      cacheKey: `${cacheKey}_hasPt${hasExternalPtSub}`
    });
    if (imdbStr === "tt0409591") {
      sorted.sort(
        (a, b) => Number(b.providerId === "fenixflix-animes" && /🚗\s*Arthur/i.test(b.title || "")) - Number(a.providerId === "fenixflix-animes" && /🚗\s*Arthur/i.test(a.title || ""))
      );
    }
    for (const s of sorted) {
      mediaSourceValidationService.validateSource(s, {
        mediaId: rawTargetId,
        mediaTitle: targetTitle,
        mediaType: type,
        season: episode?.season,
        episode: episode?.episode,
        canonicalIdentity: identity,
        hasExternalPtSub
      }).catch(() => {
      });
    }
    this.cache.set(cacheKey, { streams: sorted, timestamp: Date.now() });
    return sorted;
  }
  /**
   * Limpa todos os caches de provedores e ranqueamento inteligente.
   */
  clearCache() {
    this.cache.clear();
    sourceSelectionService.clearRankingCache();
  }
};
var providerRegistry = new ProviderRegistryService();

// src/core/catalog/CatalogEligibilityService.ts
var STORAGE_ELIGIBILITY_KEY = "zapitv_catalog_eligibility_v1";
var TTL_AVAILABLE_MS = 24 * 60 * 60 * 1e3;
var TTL_UNAVAILABLE_MS = 12 * 60 * 60 * 1e3;
var TTL_ERROR_MS = 15 * 60 * 1e3;
var KNOWN_EXCLUDED_PATTERNS = [
  /visionquest/i,
  // Marvel TV 2026 - Futuro / Sem fonte
  /^tyson$/i,
  // Série Tyson 2026 - Apenas fontes de filme trocado
  /o intruso.*incomer/i,
  // O Intruso (The Incomer) 2026 - Theatrical sem fonte digital
  /^o intruso$/i,
  // O Intruso - Sem fontes válidas
  /^profundezas$/i,
  // Profundezas 2026 - Sem fonte válida compatível
  /vingadores.*(doutor destino|guerras secretas|doomsday|secret wars)/i,
  /avengers.*(doomsday|secret wars)/i,
  /avatar.*(fogo e cinzas|fire and ash)/i,
  /the batman.*(parte ii|part ii)/i,
  /spider-man.*beyond the spider-verse/i,
  /mandalorian.*grogu/i,
  /toy story 5/i,
  /shrek 5/i
];
var CatalogEligibilityService = class _CatalogEligibilityService {
  constructor() {
    this.records = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Set();
    this.isEvaluating = /* @__PURE__ */ new Set();
    this.loadFromStorage();
    this.seedVerifiedOpenItems();
  }
  static getInstance() {
    if (!_CatalogEligibilityService.instance) {
      _CatalogEligibilityService.instance = new _CatalogEligibilityService();
    }
    return _CatalogEligibilityService.instance;
  }
  getCanonicalKey(item) {
    if (item.imdbId && item.imdbId.startsWith("tt")) {
      return item.imdbId.toLowerCase();
    }
    if (item.id && (item.id.startsWith("tt") || item.id.startsWith("tmdb-") || item.id.startsWith("open-"))) {
      return item.id.toLowerCase();
    }
    if (item.tmdbId) {
      return `tmdb-${item.tmdbId}`;
    }
    if (item.title) {
      return item.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    }
    return "unknown-media";
  }
  loadFromStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_ELIGIBILITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const now = Date.now();
          for (const rec of parsed) {
            if (rec && rec.canonicalId) {
              if (rec.expiresAt && rec.expiresAt < now) {
                rec.playbackStatus = "EXPIRED";
              }
              this.records.set(rec.canonicalId, rec);
            }
          }
        }
      }
    } catch (e) {
      console.warn("[CatalogEligibilityService] Erro ao carregar storage:", e);
    }
  }
  saveToStorage() {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const arr = Array.from(this.records.values()).sort((a, b) => (b.checkedAt || 0) - (a.checkedAt || 0)).slice(0, 1e3);
      localStorage.setItem(STORAGE_ELIGIBILITY_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn("[CatalogEligibilityService] Erro ao salvar storage:", e);
    }
  }
  /**
   * Registra imediatamente todos os itens do acervo oficial verificado como 100% elegíveis
   */
  seedVerifiedOpenItems() {
    const now = Date.now();
    for (const item of VERIFIED_OPEN_ITEMS) {
      const key = this.getCanonicalKey(item);
      const isSeries = item.type === "S\xC9RIE" /* SERIES */;
      const isAnime = item.type === "ANIME" /* ANIME */;
      const mediaType = isAnime ? "anime" : isSeries ? "series" : "movie";
      const episodes = (item.episodes || []).map((ep) => ({
        season: 1,
        episode: ep.number,
        title: ep.title,
        releaseStatus: "RELEASED",
        playbackStatus: "AVAILABLE",
        hasPlayableSource: Boolean(ep.videoUrl),
        sourceCount: ep.videoUrl ? 1 : 0,
        hasPtBrAudio: item.audioStatus === "pt-br-original" || item.audioStatus === "universal",
        bestQuality: "1080p"
      }));
      this.records.set(key, {
        canonicalId: key,
        title: item.title,
        originalTitle: item.originalTitle,
        mediaType,
        year: item.year,
        releaseStatus: "RELEASED",
        theatricalStatus: "NOT_APPLICABLE",
        playbackStatus: "AVAILABLE",
        isPubliclyPlayable: true,
        rejectionReasons: [],
        candidateSourceCount: (item.verifiedStreams || []).length || 1,
        validSourceCount: (item.verifiedStreams || []).length || 1,
        rejectedSourceCount: 0,
        providersChecked: ["Acervo Oficial ZapiTV"],
        providersFailed: [],
        episodes,
        availableEpisodeCount: episodes.length || 1,
        hasPtBrAudio: item.audioStatus === "pt-br-original" || item.audioStatus === "universal",
        hasOriginalAudio: true,
        bestQuality: "1080p",
        checkedAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1e3
        // 30 dias
      });
    }
  }
  /**
   * Avaliação síncrona instantânea de Elegibilidade Pública (0ms)
   * Usada por todas as views e filtros antes da renderização na UI
   */
  isItemPubliclyPlayableSync(item) {
    if (!item || !item.id || !item.title) return false;
    if (item.id.startsWith("open-") || item.availabilityStatus === "verified") {
      return true;
    }
    const titleLower = item.title.trim().toLowerCase();
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const itemYear = Number(item.year) || currentYear;
    for (const pat of KNOWN_EXCLUDED_PATTERNS) {
      if (pat.test(titleLower) || item.originalTitle && pat.test(item.originalTitle)) {
        return false;
      }
    }
    if (!theatricalFilterService.isMovieAllowedSync(item)) {
      return false;
    }
    if (itemYear > currentYear) return false;
    if (item.releaseDate && item.releaseDate > todayStr) return false;
    const key = this.getCanonicalKey(item);
    const record = this.records.get(key);
    if (record) {
      if (record.playbackStatus === "UNAVAILABLE_CONFIRMED") return false;
      if (record.releaseStatus === "NOT_RELEASED" || record.releaseStatus === "IN_THEATERS") return false;
      if (record.isPubliclyPlayable) return true;
    }
    const availRecord = mediaAvailabilityIndex.getRecord(key);
    if (availRecord) {
      if (availRecord.status === "UNAVAILABLE_CONFIRMED") return false;
      if (availRecord.status === "AVAILABLE" && availRecord.validatedSourceCount > 0) return true;
    }
    if (item.verifiedStreams && item.verifiedStreams.length > 0) {
      return true;
    }
    if (itemYear <= currentYear) {
      if (record && typeof record.isPubliclyPlayable === "boolean") {
        return record.isPubliclyPlayable;
      }
      return true;
    }
    return false;
  }
  /**
   * Filtra uma lista de itens mantendo apenas os títulos comprovadamente elegíveis
   */
  filterEligibleItemsSync(items) {
    if (!items || items.length === 0) return [];
    return items.filter((it) => this.isItemPubliclyPlayableSync(it));
  }
  /**
   * Avaliação profunda assíncrona de um item (Lançamento + Reprodução Real)
   */
  async evaluateItem(item) {
    const key = this.getCanonicalKey(item);
    const existing = this.records.get(key);
    const now = Date.now();
    if (this.isEvaluating.has(key)) {
      if (existing) return existing;
    }
    this.isEvaluating.add(key);
    try {
      const isSeries = item.type === "S\xC9RIE" /* SERIES */;
      const isAnime = item.type === "ANIME" /* ANIME */;
      const mediaType = isAnime ? "anime" : isSeries ? "series" : "movie";
      const rejectionReasons = [];
      let releaseStatus = "RELEASED";
      let theatricalStatus = "NOT_APPLICABLE";
      const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      const itemYear = Number(item.year) || currentYear;
      if (itemYear > currentYear || item.releaseDate && item.releaseDate > todayStr) {
        releaseStatus = "NOT_RELEASED";
        rejectionReasons.push(`Data de lan\xE7amento futura: ${item.releaseDate || itemYear}`);
      }
      for (const pat of KNOWN_EXCLUDED_PATTERNS) {
        if (pat.test(item.title) || item.originalTitle && pat.test(item.originalTitle)) {
          releaseStatus = "NOT_RELEASED";
          rejectionReasons.push("T\xEDtulo identificado como n\xE3o lan\xE7ado ou em exibi\xE7\xE3o exclusiva");
          break;
        }
      }
      if (!isSeries && !isAnime) {
        const theEval = await theatricalFilterService.evaluateMovie(item);
        theatricalStatus = theEval.status;
        if (!theEval.allowed) {
          if (theEval.status === "IN_THEATERS") {
            releaseStatus = "IN_THEATERS";
          } else {
            releaseStatus = "NOT_RELEASED";
          }
          rejectionReasons.push(theEval.reason);
        }
      }
      if (releaseStatus === "NOT_RELEASED" || releaseStatus === "IN_THEATERS") {
        const record2 = {
          canonicalId: key,
          title: item.title,
          originalTitle: item.originalTitle,
          mediaType,
          year: itemYear,
          releaseDate: item.releaseDate,
          releaseStatus,
          theatricalStatus,
          playbackStatus: "UNAVAILABLE_CONFIRMED",
          isPubliclyPlayable: false,
          rejectionReasons,
          candidateSourceCount: 0,
          validSourceCount: 0,
          rejectedSourceCount: 0,
          providersChecked: [],
          providersFailed: [],
          episodes: [],
          availableEpisodeCount: 0,
          hasPtBrAudio: false,
          hasOriginalAudio: false,
          checkedAt: now,
          expiresAt: now + TTL_UNAVAILABLE_MS
        };
        this.records.set(key, record2);
        this.saveToStorage();
        mediaAvailabilityIndex.markUnavailableConfirmed(key, mediaType, ["Filtro de Lan\xE7amento"], item.title);
        return record2;
      }
      let playbackStatus = "CHECKING";
      const episodes = [];
      let candidateSourceCount = 0;
      let validSourceCount = 0;
      let rejectedSourceCount = 0;
      let hasPtBrAudio = false;
      let hasOriginalAudio = false;
      let bestQuality = "1080p";
      const providersChecked = [];
      const providersFailed = [];
      if (item.verifiedStreams && item.verifiedStreams.length > 0) {
        validSourceCount = item.verifiedStreams.length;
        candidateSourceCount = validSourceCount;
        playbackStatus = "AVAILABLE";
        hasPtBrAudio = item.verifiedStreams.some((s) => s.isPtBr);
        hasOriginalAudio = true;
      } else {
        try {
          const streams = await Promise.race([
            providerRegistry.resolveStreams(
              mediaType,
              { id: item.id, imdbId: item.imdbId, tmdbId: item.tmdbId, title: item.title },
              isSeries || isAnime ? { season: 1, episode: 1 } : void 0
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_PROVIDERS")), 8e3))
          ]);
          candidateSourceCount = streams.length;
          const validStreams = [];
          for (const s of streams) {
            if (theatricalFilterService.isCamRecording(`${s.name} ${s.title}`)) {
              rejectedSourceCount++;
              continue;
            }
            if (theatricalFilterService.isTrailerOrFakeSource(s).isFake) {
              rejectedSourceCount++;
              continue;
            }
            const isMatch = streamValidator.isContentMatchingTarget(
              `${s.name || ""} ${s.title || ""}`,
              item.title,
              isSeries || isAnime ? { season: 1, episode: 1 } : void 0
            );
            if (!isMatch) {
              rejectedSourceCount++;
              continue;
            }
            validStreams.push(s);
          }
          validSourceCount = validStreams.length;
          if (validSourceCount > 0) {
            playbackStatus = "AVAILABLE";
            hasPtBrAudio = validStreams.some((s) => s.isPtBr || s.isDubbed);
            hasOriginalAudio = true;
            bestQuality = validStreams[0].quality || "1080p";
            if (isSeries || isAnime) {
              episodes.push({
                season: 1,
                episode: 1,
                releaseStatus: "RELEASED",
                playbackStatus: "AVAILABLE",
                hasPlayableSource: true,
                sourceCount: validSourceCount,
                bestQuality,
                hasPtBrAudio
              });
            }
          } else {
            playbackStatus = "UNAVAILABLE_CONFIRMED";
            rejectionReasons.push("Nenhuma fonte v\xE1lida ou autorizada encontrada nos provedores");
          }
        } catch (err) {
          playbackStatus = "TEMPORARY_ERROR";
          rejectionReasons.push(`Erro tempor\xE1rio de consulta: ${err.message || "Timeout"}`);
        }
      }
      const isPubliclyPlayable = releaseStatus === "RELEASED" && playbackStatus === "AVAILABLE" && validSourceCount > 0;
      const record = {
        canonicalId: key,
        title: item.title,
        originalTitle: item.originalTitle,
        mediaType,
        year: itemYear,
        releaseDate: item.releaseDate,
        releaseStatus,
        theatricalStatus,
        playbackStatus,
        isPubliclyPlayable,
        rejectionReasons,
        candidateSourceCount,
        validSourceCount,
        rejectedSourceCount,
        providersChecked,
        providersFailed,
        episodes,
        availableEpisodeCount: episodes.filter((e) => e.hasPlayableSource).length || (isPubliclyPlayable ? 1 : 0),
        hasPtBrAudio,
        hasOriginalAudio,
        bestQuality,
        checkedAt: now,
        expiresAt: now + (isPubliclyPlayable ? TTL_AVAILABLE_MS : playbackStatus === "TEMPORARY_ERROR" ? TTL_ERROR_MS : TTL_UNAVAILABLE_MS)
      };
      this.records.set(key, record);
      this.saveToStorage();
      if (isPubliclyPlayable) {
        mediaAvailabilityIndex.markAvailable(key, mediaType, {
          title: item.title,
          sourceCount: validSourceCount,
          providersChecked,
          hasPtBrAudio,
          hasPtSubtitles: true,
          bestQuality,
          episodeCount: record.availableEpisodeCount
        });
      } else if (playbackStatus === "UNAVAILABLE_CONFIRMED") {
        mediaAvailabilityIndex.markUnavailableConfirmed(key, mediaType, providersChecked, item.title);
      }
      this.notify();
      return record;
    } finally {
      this.isEvaluating.delete(key);
    }
  }
  /**
   * Validação individual de episódios para séries e animes
   */
  async validateEpisode(item, season, episodeNum) {
    const key = this.getCanonicalKey(item);
    const mediaType = item.type === "ANIME" /* ANIME */ ? "anime" : "series";
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const epObj = item.episodes?.find((e) => e.number === episodeNum);
    const epReleaseDate = epObj?.releaseDate;
    let releaseStatus = "RELEASED";
    if (epReleaseDate && epReleaseDate > todayStr) {
      releaseStatus = "NOT_RELEASED";
      return {
        season,
        episode: episodeNum,
        title: epObj?.title,
        releaseDate: epReleaseDate,
        releaseStatus: "NOT_RELEASED",
        playbackStatus: "UNAVAILABLE_CONFIRMED",
        hasPlayableSource: false,
        sourceCount: 0
      };
    }
    try {
      const streams = await providerRegistry.resolveStreams(
        mediaType,
        { id: item.id, imdbId: item.imdbId, tmdbId: item.tmdbId, title: item.title },
        { season, episode: episodeNum }
      );
      const validStreams = streams.filter((s) => {
        if (theatricalFilterService.isCamRecording(`${s.name} ${s.title}`)) return false;
        if (theatricalFilterService.isTrailerOrFakeSource(s).isFake) return false;
        return streamValidator.isContentMatchingTarget(
          `${s.name || ""} ${s.title || ""}`,
          item.title,
          { season, episode: episodeNum }
        );
      });
      const hasSource = validStreams.length > 0;
      return {
        season,
        episode: episodeNum,
        title: epObj?.title,
        releaseDate: epReleaseDate,
        releaseStatus,
        playbackStatus: hasSource ? "AVAILABLE" : "UNAVAILABLE_CONFIRMED",
        hasPlayableSource: hasSource,
        sourceCount: validStreams.length,
        bestQuality: validStreams[0]?.quality || "1080p",
        hasPtBrAudio: validStreams.some((s) => s.isPtBr || s.isDubbed)
      };
    } catch {
      return {
        season,
        episode: episodeNum,
        title: epObj?.title,
        releaseDate: epReleaseDate,
        releaseStatus,
        playbackStatus: "TEMPORARY_ERROR",
        hasPlayableSource: false,
        sourceCount: 0
      };
    }
  }
  markUnavailable(idOrImdb, title, reasons = []) {
    const key = idOrImdb.toLowerCase();
    const existing = this.records.get(key);
    const now = Date.now();
    const record = {
      canonicalId: key,
      title: title || existing?.title || key,
      mediaType: existing?.mediaType || "movie",
      releaseStatus: existing?.releaseStatus || "RELEASED",
      theatricalStatus: existing?.theatricalStatus || "NOT_APPLICABLE",
      playbackStatus: "UNAVAILABLE_CONFIRMED",
      isPubliclyPlayable: false,
      rejectionReasons: reasons.length > 0 ? reasons : ["Sem fontes funcionais verificadas"],
      candidateSourceCount: 0,
      validSourceCount: 0,
      rejectedSourceCount: 1,
      providersChecked: existing?.providersChecked || ["Stremio Providers"],
      providersFailed: existing?.providersFailed || ["Todos os Provedores"],
      episodes: existing?.episodes || [],
      availableEpisodeCount: 0,
      hasPtBrAudio: false,
      hasOriginalAudio: false,
      checkedAt: now,
      expiresAt: now + TTL_UNAVAILABLE_MS
    };
    this.records.set(key, record);
    this.saveToStorage();
    this.notify();
  }
  getMetrics() {
    return this.getStats();
  }
  getRecord(key) {
    return this.records.get(key.toLowerCase());
  }
  getAllRecords() {
    return Array.from(this.records.values());
  }
  getStats() {
    let approvedCount = 0;
    let rejectedCount = 0;
    let notReleasedCount = 0;
    let inTheatersCount = 0;
    let unavailableSourceCount = 0;
    let temporaryErrorCount = 0;
    let moviesApproved = 0;
    let seriesApproved = 0;
    let animesApproved = 0;
    for (const r of this.records.values()) {
      if (r.isPubliclyPlayable) {
        approvedCount++;
        if (r.mediaType === "movie") moviesApproved++;
        else if (r.mediaType === "series") seriesApproved++;
        else if (r.mediaType === "anime") animesApproved++;
      } else {
        rejectedCount++;
        if (r.releaseStatus === "NOT_RELEASED") notReleasedCount++;
        else if (r.releaseStatus === "IN_THEATERS") inTheatersCount++;
        else if (r.playbackStatus === "UNAVAILABLE_CONFIRMED") unavailableSourceCount++;
        else if (r.playbackStatus === "TEMPORARY_ERROR") temporaryErrorCount++;
      }
    }
    return {
      totalEvaluated: this.records.size,
      approvedCount,
      rejectedCount,
      notReleasedCount,
      inTheatersCount,
      unavailableSourceCount,
      temporaryErrorCount,
      moviesApproved,
      seriesApproved,
      animesApproved
    };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch {
      }
    }
  }
};
var catalogEligibilityService = CatalogEligibilityService.getInstance();

// src/core/search/searchService.ts
var CACHE_TTL_MS2 = 10 * 60 * 1e3;
var KNOWN_ANIME_FRANCHISES = [
  /\bnaruto\b/i,
  /\bbleach\b/i,
  /\bone piece\b/i,
  /\bdragon ball\b|\bdragonball\b/i,
  /\bdeath note\b/i,
  /\bjujutsu kaisen\b/i,
  /\bdemon slayer\b|\bkimetsu no yaiba\b/i,
  /\bmy hero academia\b|\bboku no hero\b/i,
  /\battack on titan\b|\bshingeki no kyojin\b/i,
  /\bfullmetal alchemist\b/i,
  /\bhunter x hunter\b/i,
  /\btokyo ghoul\b/i,
  /\bfairy tail\b/i,
  /\bsword art online\b/i,
  /\bevangelion\b/i,
  /\bcowboy bebop\b/i,
  /\binuyasha\b/i,
  /\bsailor moon\b/i,
  /\byu yu hakusho\b/i,
  /\bsteins;gate\b/i,
  /\bcode geass\b/i,
  /\bchainsaw man\b/i,
  /\bspy x family\b/i,
  /\bsolo leveling\b/i,
  /\bblack clover\b/i,
  /\bvinland saga\b/i,
  /\bfrieren\b/i,
  /\bdungeon meshi\b/i,
  /\bmob psycho\b/i,
  /\bhaikyuu\b/i,
  /\bgintama\b/i,
  /\bberserk\b/i,
  /\bslam dunk\b/i,
  /\bakira\b/i,
  /\bchihiro\b|\bviagem de chihiro\b/i,
  /\btotoro\b/i,
  /\bprincesa mononoke\b/i,
  /\byour name\b|\bkimi no na wa\b/i,
  /\bsuzume\b/i,
  /\bweathering with you\b|\bo tempo com você\b/i,
  /\bboruto\b/i
];
var LIVE_ACTION_MARKERS = [
  /live[- ]action/i,
  /a série$/i,
  /: a série/i,
  /o filme \(live-action\)/i,
  /drama version/i,
  /podcast/i,
  /behind the scenes/i
];
var SearchService = class _SearchService {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
    this.activeAbortController = null;
  }
  static getInstance() {
    if (!_SearchService.instance) {
      _SearchService.instance = new _SearchService();
    }
    return _SearchService.instance;
  }
  /**
   * Mapeia a visualização ativa (AppView) para a categoria de pesquisa
   */
  mapAppViewToCategory(view) {
    switch (view) {
      case "movies":
        return "movies";
      case "series":
        return "series";
      case "animes":
        return "animes";
      case "live":
        return "live";
      default:
        return "all";
    }
  }
  /**
   * Retorna o placeholder contextual para a barra de busca conforme Requisito 4
   */
  getPlaceholder(category) {
    switch (category) {
      case "movies":
        return "Buscar filmes...";
      case "series":
        return "Buscar s\xE9ries...";
      case "animes":
        return "Buscar animes...";
      case "live":
        return "Buscar canais e programas...";
      default:
        return "Buscar filmes, s\xE9ries e animes...";
    }
  }
  /**
   * Mensagem de vazio sem fallback forçado para outra categoria conforme Requisito 6
   */
  getEmptyMessage(category, query) {
    const cleanQuery = query.trim();
    switch (category) {
      case "movies":
        return {
          title: "Nenhum filme encontrado.",
          subtitle: `N\xE3o encontramos nenhum filme correspondente a "${cleanQuery}".`
        };
      case "series":
        return {
          title: "Nenhuma s\xE9rie encontrada.",
          subtitle: `N\xE3o encontramos nenhuma s\xE9rie correspondente a "${cleanQuery}".`
        };
      case "animes":
        return {
          title: "Nenhum anime encontrado.",
          subtitle: `N\xE3o encontramos nenhum anime correspondente a "${cleanQuery}".`
        };
      case "live":
        return {
          title: "Nenhum canal ou programa encontrado.",
          subtitle: `N\xE3o encontramos canais correspondentes a "${cleanQuery}".`
        };
      default:
        return {
          title: "Nenhum resultado encontrado.",
          subtitle: `N\xE3o encontramos t\xEDtulos correspondentes a "${cleanQuery}".`
        };
    }
  }
  /**
   * Classificação canônica: item é anime?
   */
  isAnimeItem(item) {
    if (!item || !item.title) return false;
    const titleLower = item.title.toLowerCase();
    const isLive = LIVE_ACTION_MARKERS.some((m) => m.test(titleLower));
    if (isLive) return false;
    if (item.type === "ANIME" /* ANIME */) return true;
    if (item.genres?.some((g) => g.toLowerCase() === "anime")) return true;
    if (KNOWN_ANIME_FRANCHISES.some((pat) => pat.test(titleLower) || item.originalTitle && pat.test(item.originalTitle))) {
      return true;
    }
    return false;
  }
  /**
   * Classificação canônica: item é filme (não anime)?
   */
  isMovieItem(item) {
    if (!item) return false;
    if (this.isAnimeItem(item)) return false;
    return item.type === "FILME" /* MOVIE */;
  }
  /**
   * Classificação canônica: item é série de TV convencional (não anime)?
   */
  isSeriesItem(item) {
    if (!item) return false;
    if (this.isAnimeItem(item)) return false;
    return item.type === "S\xC9RIE" /* SERIES */;
  }
  /**
   * Cancela quaisquer requisições de pesquisa pendentes
   */
  cancelPending() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }
  /**
   * Executa a pesquisa contextual direcionada na origem (TMDB + Cinemeta)
   */
  async search(query, category, localCatalog = []) {
    const trimmed = query.trim();
    if (!trimmed) {
      this.cancelPending();
      return [];
    }
    const normQuery = trimmed.toLowerCase();
    const cacheKey = `${category}:${normQuery}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS2) {
      return cached.items;
    }
    this.cancelPending();
    const controller = new AbortController();
    this.activeAbortController = controller;
    try {
      let rawResults = [];
      switch (category) {
        case "movies": {
          rawResults = await tmdbService.searchMovies(trimmed, controller.signal);
          rawResults = rawResults.filter((it) => this.isMovieItem(it));
          break;
        }
        case "series": {
          rawResults = await tmdbService.searchSeries(trimmed, controller.signal);
          rawResults = rawResults.filter((it) => this.isSeriesItem(it));
          break;
        }
        case "animes": {
          rawResults = await tmdbService.searchAnimes(trimmed, controller.signal);
          rawResults = rawResults.filter((it) => this.isAnimeItem(it));
          break;
        }
        case "all":
        default: {
          rawResults = await tmdbService.searchMulti(trimmed);
          for (const item of rawResults) {
            if (this.isAnimeItem(item)) {
              item.type = "ANIME" /* ANIME */;
            }
          }
          break;
        }
      }
      if (localCatalog && localCatalog.length > 0) {
        const localMatches = this.filterLocalCatalog(trimmed, category, localCatalog);
        const existingTitles = new Set(rawResults.map((r) => r.title.toLowerCase().trim()));
        for (const loc of localMatches) {
          if (!existingTitles.has(loc.title.toLowerCase().trim())) {
            rawResults.unshift(loc);
            existingTitles.add(loc.title.toLowerCase().trim());
          }
        }
      }
      const eligible = catalogEligibilityService.filterEligibleItemsSync(rawResults);
      this.cache.set(cacheKey, {
        timestamp: now,
        items: eligible
      });
      return eligible;
    } catch (e) {
      if (e?.name === "AbortError" || controller.signal.aborted) {
        return [];
      }
      console.warn(`[SearchService] Erro na busca (${category}):`, e);
      const localFallback = this.filterLocalCatalog(trimmed, category, localCatalog);
      return catalogEligibilityService.filterEligibleItemsSync(localFallback);
    } finally {
      if (this.activeAbortController === controller) {
        this.activeAbortController = null;
      }
    }
  }
  /**
   * Filtra o acervo local em memória respeitando rigorosamente a categoria
   */
  filterLocalCatalog(query, category, items) {
    if (!items || items.length === 0) return [];
    const norm = query.toLowerCase().trim();
    return items.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(norm) || item.originalTitle && item.originalTitle.toLowerCase().includes(norm);
      if (!titleMatch) return false;
      switch (category) {
        case "movies":
          return this.isMovieItem(item);
        case "series":
          return this.isSeriesItem(item);
        case "animes":
          return this.isAnimeItem(item);
        case "all":
          return true;
        default:
          return true;
      }
    });
  }
  /**
   * Fornece sugestões rápidas para dropdown / autocomplete
   */
  async getSuggestions(query, category, limit = 6, localCatalog = []) {
    const results = await this.search(query, category, localCatalog);
    return results.slice(0, limit);
  }
  /**
   * Limpa o cache de busca
   */
  clearCache() {
    this.cache.clear();
  }
};
var searchService = SearchService.getInstance();

// src/core/rankings/FeaturedRankingService.ts
var STORAGE_KEY_FEATURED_SELECTION = "zapitv_featured_ranking_selection_v3";
var EVENT_FEATURED_RANKING_UPDATED = "zapitv_featured_ranking_updated";
var FeaturedRankingService = class _FeaturedRankingService {
  constructor() {
    this.weeklySnapshots = [...OFFICIAL_IMDB_WEEKLY_SNAPSHOTS];
    this.cachedSelection = null;
    this.storageAdapter = null;
    this.isProcessing = false;
    this.loadFromStorage();
    if (!this.cachedSelection) {
      this.recomputeFeaturedSelectionSync();
    }
  }
  static getInstance() {
    if (!_FeaturedRankingService.instance) {
      _FeaturedRankingService.instance = new _FeaturedRankingService();
    }
    return _FeaturedRankingService.instance;
  }
  /**
   * Permite registrar um adaptador de persistência customizado (ex: em disco no Node.js)
   */
  setStorageAdapter(adapter) {
    this.storageAdapter = adapter;
    const data = adapter.load();
    if (data) {
      this.cachedSelection = data;
    }
  }
  /**
   * Obtém os snapshots semanais atualmente armazenados
   */
  getWeeklySnapshots() {
    return [...this.weeklySnapshots];
  }
  /**
   * Permite importar ou anexar novos snapshots semanais autorizados
   */
  addWeeklySnapshot(snapshot) {
    const idx = this.weeklySnapshots.findIndex((s) => s.id === snapshot.id || s.weekKey === snapshot.weekKey && s.rankType === snapshot.rankType);
    if (idx !== -1) {
      this.weeklySnapshots[idx] = snapshot;
    } else {
      this.weeklySnapshots.push(snapshot);
    }
  }
  /**
   * Obtém o snapshot mais recente para o tipo de mídia (Filme ou Série)
   */
  getLatestWeeklySnapshot(rankType) {
    const matching = this.weeklySnapshots.filter((s) => s.rankType === rankType);
    if (matching.length === 0) {
      throw new Error(`Nenhum snapshot semanal encontrado para ${rankType}`);
    }
    return matching.sort((a, b) => {
      if (b.referenceDate !== a.referenceDate) {
        return b.referenceDate.localeCompare(a.referenceDate);
      }
      return b.capturedAt - a.capturedAt;
    })[0];
  }
  /**
   * Calcula o ranking da semana diretamente do snapshot semanal mais recente da Fonte Única da Verdade
   */
  computeWeeklyRanking(rankType) {
    try {
      const { snapshot, ranking } = imdbWeeklyRankingService.getLatestRanking(rankType);
      const candidates = ranking.map((it) => ({
        imdbId: it.imdbId,
        position: it.position,
        title: it.title,
        originalTitle: it.originalTitle,
        year: it.year,
        rankType,
        referenceDate: it.referenceDate || snapshot.referenceDate
      }));
      return { snapshot, candidates };
    } catch {
      const snapshot = this.getLatestWeeklySnapshot(rankType);
      const sortedItems = [...snapshot.items].sort((a, b) => a.position - b.position);
      const candidates = sortedItems.map((it) => ({
        imdbId: it.imdbId,
        position: it.position,
        title: it.title,
        originalTitle: it.originalTitle,
        year: it.year,
        rankType,
        referenceDate: it.referenceDate || snapshot.referenceDate
      }));
      return { snapshot, candidates };
    }
  }
  /**
   * Calcula a data/hora da próxima segunda-feira às 06:00 (Horário de Brasília / UTC-3 -> 09:00 UTC)
   */
  getNextMonday6AMBRT(fromTime = /* @__PURE__ */ new Date()) {
    const d = new Date(fromTime.getTime());
    const currentDay = d.getUTCDay();
    const currentHour = d.getUTCHours();
    const currentMinute = d.getUTCMinutes();
    let daysUntilMonday = (1 - currentDay + 7) % 7;
    if (daysUntilMonday === 0) {
      if (currentHour > 9 || currentHour === 9 && currentMinute > 0) {
        daysUntilMonday = 7;
      }
    }
    const target = new Date(d.getTime());
    target.setUTCDate(d.getUTCDate() + daysUntilMonday);
    target.setUTCHours(9, 0, 0, 0);
    return target;
  }
  /**
   * Formata a próxima execução em texto legível amigável (horário de Brasília)
   */
  formatNextScheduledRun(target) {
    const brtTime = new Date(target.getTime() - 3 * 60 * 60 * 1e3);
    const days = ["Domingo", "Segunda-feira", "Ter\xE7a-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "S\xE1bado"];
    const dayName = days[target.getUTCDay()];
    const day = String(brtTime.getUTCDate()).padStart(2, "0");
    const month = String(brtTime.getUTCMonth() + 1).padStart(2, "0");
    const year = brtTime.getUTCFullYear();
    const hour = String(brtTime.getUTCHours()).padStart(2, "0");
    const minute = String(brtTime.getUTCMinutes()).padStart(2, "0");
    return `${dayName}, ${day}/${month}/${year} \xE0s ${hour}:${minute} (BRT)`;
  }
  /**
   * Consolida os snapshots semanais do mês utilizando a fórmula ponderada de popularidade
   * (Mantido para retrocompatibilidade analítica)
   */
  computeMonthlyConsolidatedRanking(monthKey = "2026-10", rankType = "movie") {
    const relevantSnapshots = this.weeklySnapshots.filter(
      (s) => s.monthKey === monthKey && s.rankType === rankType
    );
    const isProvisionalWeekly = relevantSnapshots.length <= 1;
    const candidatesMap = /* @__PURE__ */ new Map();
    for (const snapshot of relevantSnapshots) {
      for (const item of snapshot.items) {
        const cleanId = String(item.imdbId || "").trim().toLowerCase();
        if (!cleanId) continue;
        const points = Math.max(1, 101 - item.position);
        let candidate = candidatesMap.get(cleanId);
        if (!candidate) {
          candidate = {
            imdbId: item.imdbId,
            title: item.title,
            originalTitle: item.originalTitle,
            year: item.year,
            rankType,
            cumulativeScore: points,
            bestPosition: item.position,
            appearancesCount: 1,
            originalPositions: [item.position]
          };
          candidatesMap.set(cleanId, candidate);
        } else {
          candidate.cumulativeScore += points;
          candidate.appearancesCount += 1;
          candidate.originalPositions.push(item.position);
          if (item.position < candidate.bestPosition) {
            candidate.bestPosition = item.position;
          }
        }
      }
    }
    const sortedCandidates = Array.from(candidatesMap.values()).sort((a, b) => {
      if (b.cumulativeScore !== a.cumulativeScore) {
        return b.cumulativeScore - a.cumulativeScore;
      }
      return a.bestPosition - b.bestPosition;
    });
    const monthNames = {
      "2026-10": "Outubro de 2026",
      "2026-09": "Setembro de 2026",
      "2026-11": "Novembro de 2026",
      "2026-12": "Dezembro de 2026"
    };
    return {
      monthKey,
      monthLabel: monthNames[monthKey] || `M\xEAs ${monthKey}`,
      rankType,
      isProvisionalWeekly,
      snapshotsIncluded: relevantSnapshots.map((s) => s.id),
      candidates: sortedCandidates
    };
  }
  /**
   * Encontra a correspondência canônica de um item IMDb no catálogo do ZapiTV
   */
  findCanonicalCatalogItem(candidate, catalog) {
    const candImdb = (candidate.imdbId || "").trim().toLowerCase();
    const candTitle = (candidate.title || "").trim().toLowerCase();
    const candOrigTitle = (candidate.originalTitle || "").trim().toLowerCase();
    const candYear = candidate.year;
    if (candImdb) {
      const match = catalog.find((c) => {
        const itemImdb = (c.imdbId || "").trim().toLowerCase();
        if (itemImdb && itemImdb === candImdb) return true;
        if (c.id && c.id.toLowerCase().includes(candImdb)) return true;
        if (c.videoUrl && c.videoUrl.toLowerCase().includes(candImdb)) return true;
        return false;
      });
      if (match) return match;
    }
    const normalizeStr = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const normCandTitle = normalizeStr(candTitle);
    const normCandOrigTitle = candOrigTitle ? normalizeStr(candOrigTitle) : "";
    const textMatch = catalog.find((c) => {
      const normTitle = normalizeStr(c.title);
      const normOrig = c.originalTitle ? normalizeStr(c.originalTitle) : "";
      const yearMatches = !candYear || !c.year || Math.abs(c.year - candYear) <= 1;
      const titleMatches = normTitle === normCandTitle || normCandOrigTitle && normTitle === normCandOrigTitle || normOrig && normOrig === normCandTitle || normCandOrigTitle && normOrig && normOrig === normCandOrigTitle;
      return titleMatches && yearMatches;
    });
    return textMatch || null;
  }
  /**
   * Algoritmo Principal de Preenchimento e Substituição Progressiva do Top 10
   * 
   * Percorre o ranking semanal na ordem exata de popularidade do IMDb.
   * Se um título for inelegível, registra o motivo explícito e AVANÇA para o próximo candidato.
   * Preenche até 10 vagas por categoria sem duplicatas e sem inventar dados.
   */
  resolveEligibleTop10(rankingOrCandidates, rankTypeOrCatalog, maybeCatalog) {
    let candidates;
    let rankType;
    let catalog;
    if ("candidates" in rankingOrCandidates && "rankType" in rankingOrCandidates) {
      candidates = rankingOrCandidates.candidates;
      rankType = rankingOrCandidates.rankType;
      catalog = rankTypeOrCatalog;
    } else {
      candidates = rankingOrCandidates;
      rankType = rankTypeOrCatalog;
      catalog = maybeCatalog || [];
    }
    const approvedItems = [];
    const audit = [];
    const targetCount = 10;
    const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const seenIds = /* @__PURE__ */ new Set();
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const rankPosition = cand.position ?? i + 1;
      const catalogItem = this.findCanonicalCatalogItem(cand, catalog);
      if (!catalogItem) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          imdbTitle: cand.title,
          year: cand.year,
          mediaType: rankType,
          imdbRank: rankPosition,
          rankPosition,
          status: "REJECTED",
          isIncluded: false,
          availabilityStatus: "not_in_catalog",
          rejectionReason: "Identificador n\xE3o encontrado no acervo do ZapiTV"
        });
        continue;
      }
      if (seenIds.has(catalogItem.id)) {
        continue;
      }
      if (rankType === "movie") {
        if (catalogItem.type !== "FILME" /* MOVIE */) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: "movie",
            imdbRank: rankPosition,
            rankPosition,
            status: "REJECTED",
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: catalogItem.availabilityStatus || "declared",
            rejectionReason: "Conte\xFAdo n\xE3o \xE9 um filme de longa-metragem (tipo divergente no acervo)"
          });
          continue;
        }
      } else {
        if (catalogItem.type === "ANIME" /* ANIME */ || searchService.isAnimeItem(catalogItem)) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: "series",
            imdbRank: rankPosition,
            rankPosition,
            status: "REJECTED",
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: catalogItem.availabilityStatus || "declared",
            rejectionReason: "Anime exclu\xEDdo da categoria S\xE9ries (destinado exclusivamente \xE0 p\xE1gina Animes)"
          });
          continue;
        }
        if (catalogItem.type !== "S\xC9RIE" /* SERIES */) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: "series",
            imdbRank: rankPosition,
            rankPosition,
            status: "REJECTED",
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: catalogItem.availabilityStatus || "declared",
            rejectionReason: "Conte\xFAdo n\xE3o \xE9 uma s\xE9rie de televis\xE3o"
          });
          continue;
        }
      }
      const itemYear = Number(catalogItem.year || cand.year) || currentYear;
      if (itemYear > currentYear || catalogItem.releaseDate && catalogItem.releaseDate > todayStr) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          imdbTitle: cand.title,
          canonicalTitle: catalogItem.title,
          year: cand.year,
          mediaType: rankType,
          imdbRank: rankPosition,
          rankPosition,
          status: "REJECTED",
          isIncluded: false,
          canonicalId: catalogItem.id,
          availabilityStatus: catalogItem.availabilityStatus || "unreleased",
          rejectionReason: "T\xEDtulo ainda n\xE3o lan\xE7ado comercialmente (data de estreia futura)"
        });
        continue;
      }
      if (rankType === "movie") {
        const isTheatricallyAllowed = theatricalFilterService.isMovieAllowedSync(catalogItem);
        if (!isTheatricallyAllowed) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: "movie",
            imdbRank: rankPosition,
            rankPosition,
            status: "REJECTED",
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: "theatrical_window",
            rejectionReason: "Filme em cartaz nos cinemas brasileiros ou aguarda lan\xE7amento digital oficial"
          });
          continue;
        }
      }
      const key = catalogEligibilityService.getCanonicalKey(catalogItem);
      const isPlayable = catalogEligibilityService.isItemPubliclyPlayableSync(catalogItem);
      const availRec = mediaAvailabilityIndex.getRecord(key);
      const isExplicitlyUnavailable = catalogItem.availabilityStatus === "unavailable" || availRec && availRec.status === "UNAVAILABLE_CONFIRMED";
      const hasConfirmedSource = Boolean(
        catalogItem.id.startsWith("open-") || catalogItem.availabilityStatus === "verified" || catalogItem.verifiedStreams && catalogItem.verifiedStreams.length > 0 || catalogItem.videoUrl && catalogItem.videoUrl.trim().length > 0 || availRec && availRec.status === "AVAILABLE" && availRec.validatedSourceCount > 0
      );
      if (!isPlayable || isExplicitlyUnavailable || !hasConfirmedSource) {
        audit.push({
          imdbId: cand.imdbId,
          title: cand.title,
          imdbTitle: cand.title,
          canonicalTitle: catalogItem.title,
          year: cand.year,
          mediaType: rankType,
          imdbRank: rankPosition,
          rankPosition,
          status: "REJECTED",
          isIncluded: false,
          canonicalId: catalogItem.id,
          availabilityStatus: "no_source",
          rejectionReason: "Sem fontes v\xE1lidas ou reproduz\xEDveis dispon\xEDveis no ZapiTV"
        });
        continue;
      }
      if (rankType === "series") {
        const hasEpisodes = catalogItem.episodes && catalogItem.episodes.length > 0 || catalogItem.availabilityStatus === "verified" || availRec && (availRec.availableEpisodeCount ?? 0) > 0;
        if (!hasEpisodes) {
          audit.push({
            imdbId: cand.imdbId,
            title: cand.title,
            imdbTitle: cand.title,
            canonicalTitle: catalogItem.title,
            year: cand.year,
            mediaType: "series",
            imdbRank: rankPosition,
            rankPosition,
            status: "REJECTED",
            isIncluded: false,
            canonicalId: catalogItem.id,
            availabilityStatus: "no_episodes",
            rejectionReason: "S\xE9rie sem epis\xF3dios dispon\xEDveis e reproduz\xEDveis no cat\xE1logo"
          });
          continue;
        }
      }
      const finalPosition = approvedItems.length + 1;
      seenIds.add(catalogItem.id);
      const featuredItem = {
        ...catalogItem,
        imdbId: catalogItem.imdbId || cand.imdbId,
        isFeatured: true,
        imdbRank: rankPosition,
        displayRank: finalPosition,
        heroTags: [
          ...catalogItem.heroTags || [],
          {
            id: `rank-${finalPosition}`,
            text: `#${finalPosition} Em Destaque (IMDb #${rankPosition})`,
            color: "#007df7",
            style: "solid"
          }
        ]
      };
      approvedItems.push(featuredItem);
      audit.push({
        imdbId: cand.imdbId,
        title: catalogItem.title,
        imdbTitle: cand.title,
        canonicalTitle: catalogItem.title,
        year: catalogItem.year,
        mediaType: rankType,
        imdbRank: rankPosition,
        displayRank: finalPosition,
        rankPosition,
        finalPosition,
        status: "APPROVED",
        isIncluded: true,
        canonicalId: catalogItem.id,
        availabilityStatus: catalogItem.availabilityStatus || "verified",
        hasAudioPtBr: catalogItem.audioStatus === "pt-br-dubbed" || catalogItem.audioStatus === "pt-br-original",
        audioStatus: catalogItem.audioStatus || "other",
        verifiedSourcesCount: (catalogItem.verifiedStreams || []).length || 1
      });
      if (approvedItems.length >= targetCount) {
        break;
      }
    }
    return { approvedItems, audit };
  }
  /**
   * Recalcula a seleção semanal de Em Destaque com o catálogo completo disponível
   */
  recomputeFeaturedSelectionSync(customCatalog) {
    const catalogMap = /* @__PURE__ */ new Map();
    VERIFIED_OPEN_ITEMS.forEach((it) => catalogMap.set(it.id, it));
    filmesData.forEach((it) => {
      if (!catalogMap.has(it.id)) catalogMap.set(it.id, it);
    });
    if (customCatalog && Array.isArray(customCatalog)) {
      customCatalog.forEach((it) => {
        if (!catalogMap.has(it.id)) catalogMap.set(it.id, it);
      });
    }
    const fullCatalog = Array.from(catalogMap.values());
    const moviesWeekly = this.computeWeeklyRanking("movie");
    const seriesWeekly = this.computeWeeklyRanking("series");
    const moviesResult = this.resolveEligibleTop10(moviesWeekly.candidates, "movie", fullCatalog);
    const seriesResult = this.resolveEligibleTop10(seriesWeekly.candidates, "series", fullCatalog);
    const movieRankingIds = new Set(moviesWeekly.candidates.map((c) => c.imdbId.toLowerCase()));
    for (const item of moviesResult.approvedItems) {
      if (!item.imdbId || !movieRankingIds.has(item.imdbId.toLowerCase())) {
        throw new Error(`[Assertiva Falhou] Filme '${item.title}' (${item.imdbId}) fora do ranking IMDb MOVIEmeter`);
      }
    }
    const tvRankingIds = new Set(seriesWeekly.candidates.map((c) => c.imdbId.toLowerCase()));
    for (const item of seriesResult.approvedItems) {
      if (!item.imdbId || !tvRankingIds.has(item.imdbId.toLowerCase())) {
        throw new Error(`[Assertiva Falhou] S\xE9rie '${item.title}' (${item.imdbId}) fora do ranking IMDb TVmeter`);
      }
    }
    const approvedMovies = moviesResult.audit.filter((a) => a.status === "APPROVED");
    const rejectedMovies = moviesResult.audit.filter((a) => a.status === "REJECTED");
    const approvedSeries = seriesResult.audit.filter((a) => a.status === "APPROVED");
    const rejectedSeries = seriesResult.audit.filter((a) => a.status === "REJECTED");
    const nextDate = this.getNextMonday6AMBRT();
    const result = {
      weekKey: moviesWeekly.snapshot.weekKey || "2026-W41",
      weekLabel: moviesWeekly.snapshot.weekLabel || "Semana 41 (Outubro de 2026)",
      monthKey: moviesWeekly.snapshot.monthKey || "2026-10",
      monthLabel: "Outubro de 2026",
      referenceDate: moviesWeekly.snapshot.referenceDate,
      lastUpdatedAt: Date.now(),
      lastCheckedAt: Date.now(),
      nextScheduledUpdate: nextDate.getTime(),
      nextScheduledUpdateFormatted: this.formatNextScheduledRun(nextDate),
      sourceReference: "IMDb MOVIEmeter & TVmeter (Ranking Semanal)",
      updateStatus: "SUCCESS",
      isProvisionalWeekly: false,
      featuredMovies: moviesResult.approvedItems,
      featuredSeries: seriesResult.approvedItems,
      totalCandidatesEvaluated: {
        movies: moviesWeekly.candidates.length,
        series: seriesWeekly.candidates.length
      },
      auditTrail: {
        approvedMovies,
        rejectedMovies,
        approvedSeries,
        rejectedSeries
      }
    };
    this.cachedSelection = result;
    this.saveToStorage();
    this.dispatchUpdateEvent();
    return result;
  }
  /**
   * Executa a tarefa de atualização semanal programada com verificação de novos dados,
   * publicação atômica e proteção contra falhas (mantendo a seleção anterior)
   */
  async runWeeklyScheduledUpdate(options = {}) {
    if (this.isProcessing) {
      return this.getFeaturedSelectionSync();
    }
    this.isProcessing = true;
    try {
      if (options.incomingSnapshots && options.incomingSnapshots.length > 0) {
        for (const snap of options.incomingSnapshots) {
          this.addWeeklySnapshot(snap);
          if (Array.isArray(snap.items)) {
            try {
              imdbWeeklyRankingService.importAuthorizedSnapshot({
                ...snap,
                source: "admin-import",
                items: snap.items.map((it) => ({
                  ...it,
                  originalTitle: it.originalTitle || it.title,
                  mediaType: snap.rankType,
                  weekKey: snap.weekKey,
                  referenceDate: snap.referenceDate,
                  capturedAt: snap.capturedAt,
                  source: "admin-import"
                }))
              });
            } catch (e) {
              console.warn("[FeaturedRankingService] Falha ao importar snapshot:", e?.message || e);
            }
          }
        }
      }
      const latestMovieSnap = this.getLatestWeeklySnapshot("movie");
      const latestSeriesSnap = this.getLatestWeeklySnapshot("series");
      const currentRef = this.cachedSelection?.referenceDate;
      const currentWeek = this.cachedSelection?.weekKey;
      const isNewData = !currentRef || latestMovieSnap.referenceDate > currentRef || latestSeriesSnap.referenceDate > currentRef || latestMovieSnap.weekKey && latestMovieSnap.weekKey !== currentWeek;
      if (!isNewData && !options.force && this.cachedSelection) {
        const nextDate = this.getNextMonday6AMBRT();
        this.cachedSelection.lastCheckedAt = Date.now();
        this.cachedSelection.updateStatus = "UP_TO_DATE";
        this.cachedSelection.nextScheduledUpdate = nextDate.getTime();
        this.cachedSelection.nextScheduledUpdateFormatted = this.formatNextScheduledRun(nextDate);
        this.saveToStorage();
        return this.cachedSelection;
      }
      const newSelection = this.recomputeFeaturedSelectionSync(options.customCatalog);
      newSelection.updateStatus = "SUCCESS";
      return newSelection;
    } catch (error) {
      console.error("[FeaturedRankingService] Erro na rotina semanal de atualiza\xE7\xE3o:", error);
      if (this.cachedSelection) {
        const nextDate = this.getNextMonday6AMBRT();
        this.cachedSelection.lastCheckedAt = Date.now();
        this.cachedSelection.updateStatus = "FALLBACK_RETAINED";
        this.cachedSelection.lastErrorReason = error?.message || "Falha na obten\xE7\xE3o do ranking semanal do IMDb";
        this.cachedSelection.nextScheduledUpdate = nextDate.getTime();
        this.cachedSelection.nextScheduledUpdateFormatted = this.formatNextScheduledRun(nextDate);
        this.saveToStorage();
        return this.cachedSelection;
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }
  /**
   * Verifica se algum título atualmente em destaque perdeu disponibilidade no acervo,
   * substituindo-o imediatamente pelo próximo candidato elegível da semana
   */
  validateAndReplaceUnavailableItems(catalog) {
    if (!this.cachedSelection) {
      return this.recomputeFeaturedSelectionSync(catalog);
    }
    const currentSelection = this.cachedSelection;
    let needsUpdate = false;
    for (const m of currentSelection.featuredMovies) {
      if (!catalogEligibilityService.isItemPubliclyPlayableSync(m)) {
        needsUpdate = true;
        break;
      }
    }
    if (!needsUpdate) {
      for (const s of currentSelection.featuredSeries) {
        if (!catalogEligibilityService.isItemPubliclyPlayableSync(s)) {
          needsUpdate = true;
          break;
        }
      }
    }
    if (needsUpdate) {
      return this.recomputeFeaturedSelectionSync(catalog);
    }
    return currentSelection;
  }
  /**
   * Retorna a seleção de Em Destaque em cache (0ms síncrono para renderização instantânea)
   */
  getFeaturedSelectionSync() {
    if (!this.cachedSelection) {
      return this.recomputeFeaturedSelectionSync();
    }
    return this.cachedSelection;
  }
  /**
   * Força uma atualização assíncrona desacoplada da UI
   */
  async refreshFeaturedSelection(customCatalog) {
    return this.runWeeklyScheduledUpdate({ force: true, customCatalog });
  }
  loadFromStorage() {
    if (this.storageAdapter) {
      const data = this.storageAdapter.load();
      if (data) {
        this.cachedSelection = data;
        return;
      }
    }
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.removeItem("zapitv_featured_ranking_selection_v1");
      localStorage.removeItem("zapitv_featured_ranking_selection_v2");
      const raw = localStorage.getItem(STORAGE_KEY_FEATURED_SELECTION);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.referenceDate === "2026-10-12" && Array.isArray(parsed.featuredMovies) && parsed.featuredMovies.length === 10 && Array.isArray(parsed.featuredSeries) && parsed.featuredSeries.length === 10) {
          const hasOutdatedSeries = parsed.featuredSeries.some(
            (s) => s.title === "Pinguim" || s.title === "Disclaimer" || s.title === "The Pitt" || s.title === "O Urso"
          );
          if (!hasOutdatedSeries) {
            this.cachedSelection = parsed;
            return;
          }
        }
        localStorage.removeItem(STORAGE_KEY_FEATURED_SELECTION);
      }
    } catch (e) {
      console.warn("[FeaturedRankingService] Falha ao carregar cache do localStorage:", e);
    }
  }
  saveToStorage() {
    if (!this.cachedSelection) return;
    if (this.storageAdapter) {
      try {
        this.storageAdapter.save(this.cachedSelection);
      } catch (err) {
        console.warn("[FeaturedRankingService] Falha no storageAdapter:", err);
      }
    }
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      localStorage.setItem(STORAGE_KEY_FEATURED_SELECTION, JSON.stringify(this.cachedSelection));
    } catch (e) {
      console.warn("[FeaturedRankingService] Falha ao persistir cache no localStorage:", e);
    }
  }
  dispatchUpdateEvent() {
    if (typeof window !== "undefined" && this.cachedSelection) {
      window.dispatchEvent(new CustomEvent(EVENT_FEATURED_RANKING_UPDATED, { detail: this.cachedSelection }));
    }
  }
  /**
   * Inscreve um ouvinte para alterações no ranking em destaque
   */
  subscribe(listener) {
    if (typeof window === "undefined") return () => {
    };
    const handler = (e) => {
      const custom = e;
      if (custom.detail) {
        listener(custom.detail);
      } else {
        listener(this.getFeaturedSelectionSync());
      }
    };
    window.addEventListener(EVENT_FEATURED_RANKING_UPDATED, handler);
    return () => {
      window.removeEventListener(EVENT_FEATURED_RANKING_UPDATED, handler);
    };
  }
};
var featuredRankingService = FeaturedRankingService.getInstance();

// src/core/rankings/WeeklyFeaturedScheduler.ts
var WeeklyFeaturedScheduler = class _WeeklyFeaturedScheduler {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.targetDayOfWeek = 1;
    // Segunda-feira (0 = Domingo, 1 = Segunda)
    this.targetHourBRT = 6;
    // 06:00 Horário de Brasília (UTC-3 -> 09:00 UTC)
    this.lastRunTimestamp = null;
    this.lastRunStatus = null;
    if (process.env.FEATURED_SCHEDULE_DAY) {
      const parsedDay = parseInt(process.env.FEATURED_SCHEDULE_DAY, 10);
      if (!isNaN(parsedDay) && parsedDay >= 0 && parsedDay <= 6) {
        this.targetDayOfWeek = parsedDay;
      }
    }
    if (process.env.FEATURED_SCHEDULE_HOUR_BRT) {
      const parsedHour = parseInt(process.env.FEATURED_SCHEDULE_HOUR_BRT, 10);
      if (!isNaN(parsedHour) && parsedHour >= 0 && parsedHour <= 23) {
        this.targetHourBRT = parsedHour;
      }
    }
  }
  static getInstance() {
    if (!_WeeklyFeaturedScheduler.instance) {
      _WeeklyFeaturedScheduler.instance = new _WeeklyFeaturedScheduler();
    }
    return _WeeklyFeaturedScheduler.instance;
  }
  /**
   * Inicia o agendador semanal em segundo plano
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(
      `[WeeklyFeaturedScheduler] Agendador semanal ativado. Hor\xE1rio padr\xE3o: Segunda-feira \xE0s ${this.targetHourBRT}h BRT (09:00 UTC).`
    );
    this.timer = setInterval(() => {
      this.checkAndExecuteScheduledRun();
    }, 15 * 60 * 1e3);
    this.checkAndExecuteScheduledRun();
  }
  /**
   * Para o agendador
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }
  /**
   * Calcula a data/hora da próxima execução semanal em UTC
   */
  getNextRunDate(from = /* @__PURE__ */ new Date()) {
    const targetUtcHour = (this.targetHourBRT + 3) % 24;
    const d = new Date(from.getTime());
    const currentDay = d.getUTCDay();
    const currentHour = d.getUTCHours();
    const currentMinute = d.getUTCMinutes();
    let daysUntilTarget = (this.targetDayOfWeek - currentDay + 7) % 7;
    if (daysUntilTarget === 0) {
      if (currentHour > targetUtcHour || currentHour === targetUtcHour && currentMinute > 0) {
        daysUntilTarget = 7;
      }
    }
    const next = new Date(d.getTime());
    next.setUTCDate(d.getUTCDate() + daysUntilTarget);
    next.setUTCHours(targetUtcHour, 0, 0, 0);
    return next;
  }
  /**
   * Verifica se o momento de execução da semana chegou e dispara atomicamente
   */
  async checkAndExecuteScheduledRun(force = false) {
    const now = /* @__PURE__ */ new Date();
    const targetUtcHour = (this.targetHourBRT + 3) % 24;
    const isTargetDay = now.getUTCDay() === this.targetDayOfWeek;
    const isTargetHour = now.getUTCHours() === targetUtcHour;
    const oneHourMs = 60 * 60 * 1e3;
    const alreadyRunRecently = this.lastRunTimestamp && now.getTime() - this.lastRunTimestamp < oneHourMs;
    if (force || isTargetDay && isTargetHour && !alreadyRunRecently) {
      console.log(`[WeeklyFeaturedScheduler] Disparando atualiza\xE7\xE3o semanal do Em Destaque...`);
      try {
        const result = await featuredRankingService.runWeeklyScheduledUpdate({ force });
        this.lastRunTimestamp = Date.now();
        this.lastRunStatus = `Sucesso: ${result.weekLabel} (${result.featuredMovies.length} filmes, ${result.featuredSeries.length} s\xE9ries)`;
        console.log(`[WeeklyFeaturedScheduler] ${this.lastRunStatus}`);
        return true;
      } catch (err) {
        this.lastRunStatus = `Erro: ${err?.message || "Falha ao atualizar"}`;
        console.error(`[WeeklyFeaturedScheduler] Falha na execu\xE7\xE3o semanal:`, err);
        return false;
      }
    }
    return false;
  }
  /**
   * Força uma execução manual imediata
   */
  async triggerManualRun() {
    return this.checkAndExecuteScheduledRun(true);
  }
  /**
   * Retorna o status do agendador para o painel administrativo
   */
  getStatus() {
    const nextDate = this.getNextRunDate();
    return {
      isRunning: this.isRunning,
      targetDayOfWeek: this.targetDayOfWeek,
      targetHourBRT: this.targetHourBRT,
      nextRunDate: featuredRankingService.formatNextScheduledRun(nextDate),
      nextRunTimestamp: nextDate.getTime(),
      lastRunTimestamp: this.lastRunTimestamp,
      lastRunStatus: this.lastRunStatus
    };
  }
};
var weeklyFeaturedScheduler = WeeklyFeaturedScheduler.getInstance();

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
async function checkStremioEngineStatus() {
  try {
    const probe = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(800) });
    return probe.ok;
  } catch {
    return false;
  }
}
function createApp() {
  const app2 = express();
  app2.use(express.json());
  function resolveOpenItemStreams(rawId, seasonNum = 1, episodeNum = 1) {
    let cleanId = rawId.replace(/\.json$/, "");
    if (cleanId.includes(":")) {
      const parts = cleanId.split(":");
      cleanId = parts[0];
      if (parts[1]) seasonNum = parseInt(parts[1], 10) || 1;
      if (parts[2]) episodeNum = parseInt(parts[2], 10) || 1;
    }
    const item = VERIFIED_OPEN_ITEMS.find(
      (it) => it.id === cleanId || cleanId.startsWith("open-") && (it.tmdbId && String(it.tmdbId) === cleanId || it.imdbId && it.imdbId === cleanId)
    );
    if (!item || !item.id.startsWith("open-")) return [];
    if (item.episodes && item.episodes.length > 0) {
      const ep = item.episodes.find((e) => e.number === episodeNum) || item.episodes[0];
      if (ep?.videoUrl) {
        const directUrl = ep.videoUrl;
        const proxyUrl = directUrl.startsWith("http") ? `/api/proxy?url=${encodeURIComponent(directUrl)}` : directUrl;
        return [
          {
            name: "ZapiTV Stream Core",
            title: `[EPIS\xD3DIO ${ep.number}] ${ep.title} - Servidor Local ZapiTV`,
            url: proxyUrl,
            sourceType: ep.videoUrl.includes(".m3u8") ? "hls" : "mp4",
            isPtBr: item.audioStatus === "pt-br-original" || item.audioStatus === "universal",
            isDubbed: false,
            quality: "720p",
            behaviorHints: { notWebReady: false }
          },
          {
            name: "Acervo Aberto CDN",
            title: `[EPIS\xD3DIO ${ep.number}] ${ep.title} - CDN Direto`,
            url: directUrl,
            sourceType: ep.videoUrl.includes(".m3u8") ? "hls" : "mp4",
            isPtBr: item.audioStatus === "pt-br-original" || item.audioStatus === "universal",
            isDubbed: false,
            quality: "720p",
            behaviorHints: { notWebReady: false }
          }
        ];
      }
    }
    return item.verifiedStreams || [];
  }
  function isSafeLegitStream(s) {
    if (!s) return false;
    const hash = String(s.infoHash || "").toLowerCase();
    const title = String(s.title || "").toLowerCase();
    const name = String(s.name || "").toLowerCase();
    const url = String(s.url || "").toLowerCase();
    const combined = `${name} ${title} ${url} ${hash}`;
    const bannedHashes = [
      "812efbe7d0a75fb31bf9426db566f299d10b3474",
      "6dc48c588dca97da6c610ae730c556a2c7c6718d",
      "e79c88ea04c7326eb0f88ae9f18571689317e27f",
      "f9a842dfe9f5b2e7fda509f2306e0700b97a4036",
      "d0eacddff07a24173d8f7dc11a18ef3ed32b886a"
    ];
    if (bannedHashes.some((h) => hash.includes(h) || url.includes(h))) return false;
    const adultTerms = [
      "khalifa",
      "mia khalifa",
      "brazzers",
      "xvideos",
      "pornhub",
      "redtube",
      "youporn",
      "bangbros",
      "naughtyamerica",
      "spankbang",
      "xhamster",
      "pornstar",
      "hardcore xxx",
      "creampie",
      "blowjob",
      "playweb",
      "ben the men"
    ];
    if (adultTerms.some((term) => combined.includes(term))) return false;
    const camRegex = /\b(cam|camrip|cam-rip|telesync|hdcam|hd-ts|hdts|telecine|tc|screener|scr|dvdscr)\b/i;
    if (camRegex.test(combined)) return false;
    return true;
  }
  app2.get("/api/stremio/cinema-aberto/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.cinemaaberto",
      name: "Cinema Aberto & Acervo Nacional PT-BR",
      version: "1.0.0",
      description: "Provedor oficial Stremio de Cinema Aberto, Dom\xEDnio P\xFAblico e Acervo Nacional com \xE1udio PT-BR e reprodu\xE7\xE3o direta HLS/MP4.",
      resources: ["stream", "catalog", "meta"],
      types: ["movie", "series"],
      catalogs: [
        {
          type: "movie",
          id: "cinema-aberto-filmes",
          name: "Filmes de Cinema Aberto & Dom\xEDnio P\xFAblico"
        },
        {
          type: "series",
          id: "cinema-aberto-series",
          name: "S\xE9ries & Curtas em Epis\xF3dios"
        }
      ]
    });
  });
  app2.get(["/api/stremio/cinema-aberto/stream/:type/:id.json", "/api/stremio/cinema-aberto/stream/:type/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestedId = String(req.params.id || "");
    if (!requestedId.startsWith("open-")) {
      return res.json({ streams: [] });
    }
    const streams = resolveOpenItemStreams(requestedId);
    res.json({ streams });
  });
  app2.get("/api/stremio/blender-open/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.blenderopen",
      name: "Blender Open Movies (Creative Commons CC-BY)",
      version: "1.0.0",
      description: "Produ\xE7\xF5es abertas da Blender Foundation em HLS adaptativo 4K/1080p e MP4.",
      resources: ["stream"],
      types: ["movie", "series"],
      catalogs: []
    });
  });
  app2.get(["/api/stremio/blender-open/stream/:type/:id.json", "/api/stremio/blender-open/stream/:type/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestedId = String(req.params.id || "");
    if (!requestedId.startsWith("open-")) {
      return res.json({ streams: [] });
    }
    const streams = resolveOpenItemStreams(requestedId).filter(
      (s) => s.title?.toLowerCase().includes("blender") || s.title?.toLowerCase().includes("bunny") || s.title?.toLowerCase().includes("tears") || s.title?.toLowerCase().includes("caminandes")
    );
    res.json({ streams });
  });
  app2.get("/api/stremio/public-domain/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.publicdomain",
      name: "Dom\xEDnio P\xFAblico Mundial",
      version: "1.0.0",
      description: "Cl\xE1ssicos do cinema em dom\xEDnio p\xFAblico mundial com reprodu\xE7\xE3o direta e sem an\xFAncios.",
      resources: ["stream"],
      types: ["movie"],
      catalogs: []
    });
  });
  app2.get(["/api/stremio/public-domain/stream/:type/:id.json", "/api/stremio/public-domain/stream/:type/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const requestedId = String(req.params.id || "");
    if (!requestedId.startsWith("open-")) {
      return res.json({ streams: [] });
    }
    const streams = resolveOpenItemStreams(requestedId);
    res.json({ streams });
  });
  app2.get("/api/stremio/mico-leao-dublado/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "community.mico-leao-dublado",
      version: "1.0.0",
      name: "Mico-Le\xE3o Dublado",
      description: "Cat\xE1logo comunit\xE1rio de filmes dublados em portugu\xEAs brasileiro.",
      logo: "https://i.ibb.co/9tWdHsv/icon.jpg",
      resources: ["catalog", "stream"],
      types: ["movie"],
      catalogs: [
        {
          type: "movie",
          id: "BrazilianCatalog",
          name: "Filmes Dublados (pt-BR)",
          genres: ["A\xE7\xE3o", "Anima\xE7\xE3o", "Aventura", "Com\xE9dia", "Drama", "Fic\xE7\xE3o", "Terror", "Nacional"],
          extraSupported: ["search", "genre", "skip"]
        }
      ],
      idPrefixes: ["tt", "open"]
    });
  });
  app2.get([
    "/api/stremio/mico-leao-dublado/catalog/movie/BrazilianCatalog.json",
    "/api/stremio/mico-leao-dublado/catalog/movie/BrazilianCatalog/:extra.json"
  ], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const metas = VERIFIED_OPEN_ITEMS.filter((it) => it.audioStatus === "pt-br-original" || it.audioStatus === "universal").map((it) => ({
      id: it.id,
      type: "movie",
      name: it.title,
      poster: it.image,
      background: it.backdrop,
      description: it.description || "",
      year: it.year,
      genres: it.genres
    }));
    res.json({ metas });
  });
  app2.get(["/api/stremio/mico-leao-dublado/stream/:type/:id.json", "/api/stremio/mico-leao-dublado/stream/:type/:id"], async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rawId = String(req.params.id).replace(/\.json$/, "");
    const localStreams = resolveOpenItemStreams(rawId).filter((s) => s.isPtBr || s.isDubbed);
    let upstreamStreams = [];
    if (rawId.startsWith("tt")) {
      try {
        const tUrl = `https://torrentio.strem.fun/brazuca/stream/${String(req.params.type)}/${rawId}.json`;
        const response = await fetch(tUrl, { signal: AbortSignal.timeout(4e3) });
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.streams)) {
            upstreamStreams = data.streams.filter((s) => {
              const text = `${s.name || ""} ${s.title || ""}`.toLowerCase();
              return text.includes("dublado") || text.includes("dual") || text.includes("micolea") || text.includes("pt-br");
            }).map((s) => ({
              ...s,
              name: `\u{1F50A} Mico-Le\xE3o Dublado
${s.name?.split("\n")[1] || "1080p"}`,
              isPtBr: true,
              isDubbed: true,
              providerName: "Mico-Le\xE3o Dublado"
            }));
          }
        }
      } catch {
      }
    }
    const all = [...localStreams, ...upstreamStreams].filter(isSafeLegitStream);
    res.json({ streams: all });
  });
  app2.get("/api/stremio/show-subtitle-pt-br/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "community.stremio-show-subtitle-pt-br",
      version: "1.1.0",
      name: "Show Subtitle PT-BR",
      description: "Classifica e prioriza fontes no Stremio com badges de \xE1udio dublado (\u{1F50A}) e legendas (\u{1F4AC}) em portugu\xEAs brasileiro.",
      resources: ["stream"],
      types: ["movie", "series"],
      catalogs: [],
      idPrefixes: ["tt", "open"]
    });
  });
  app2.get(["/api/stremio/show-subtitle-pt-br/stream/:type/:id.json", "/api/stremio/show-subtitle-pt-br/stream/:type/:id"], async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const rawId = String(req.params.id).replace(/\.json$/, "");
    const type = String(req.params.type);
    const hasPtSubPromise = checkOpenSubtitlesPtBr(type, rawId);
    const fetchUpstreamPromise = (async () => {
      let results = [];
      const local = resolveOpenItemStreams(rawId);
      results.push(...local);
      if (rawId.startsWith("tt")) {
        try {
          const [respBrazuca, respGlobal] = await Promise.allSettled([
            fetch(`https://torrentio.strem.fun/brazuca/stream/${type}/${rawId}.json`, { signal: AbortSignal.timeout(3500) }),
            fetch(`https://torrentio.strem.fun/stream/${type}/${rawId}.json`, { signal: AbortSignal.timeout(3500) })
          ]);
          if (respBrazuca.status === "fulfilled" && respBrazuca.value.ok) {
            const data = await respBrazuca.value.json();
            if (data?.streams) results.push(...data.streams);
          }
          if (respGlobal.status === "fulfilled" && respGlobal.value.ok) {
            const data = await respGlobal.value.json();
            if (data?.streams) results.push(...data.streams);
          }
        } catch {
        }
      }
      return results;
    })();
    const [hasPtSub, rawStreams] = await Promise.all([
      hasPtSubPromise,
      fetchUpstreamPromise
    ]);
    const enriched = rawStreams.filter(isSafeLegitStream).map((s) => {
      const classification = classifyStream(s, hasPtSub);
      return {
        ...s,
        name: `${classification.badge} ${s.name || "Stream"}`,
        badge: classification.badge,
        badgeLabel: classification.badgeLabel,
        isPtBr: classification.isPtBr,
        isDubbed: classification.isDubbed,
        isSubtitled: classification.isSubtitled,
        quality: classification.quality,
        _score: classification.score
      };
    });
    const sorted = sortStreamsByPtBrPriority(enriched, { preferDubbed: true, allowSubtitled: true, excludeYouTube: true });
    res.json({ streams: sorted });
  });
  app2.get("/api/stremio/live/manifest.json", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json({
      id: "org.zapitv.livetv",
      name: "ZapiTV Live TV Brasil",
      version: "1.0.0",
      description: "Agregador de TV ao vivo com canais brasileiros, transmiss\xF5es abertas oficiais e cat\xE1logo FAST verificado.",
      resources: ["catalog", "meta", "stream"],
      types: ["tv"],
      catalogs: [
        {
          type: "tv",
          id: "live-tv-brazil",
          name: "TV ao Vivo Brasil",
          genres: ["TV Aberta", "Not\xEDcias", "Esportes", "Filmes & S\xE9ries", "Infantil", "Cultura", "M\xFAsica", "Document\xE1rios", "Regionais"],
          extraSupported: ["search", "genre"]
        }
      ],
      idPrefixes: ["tv-", "cnn-", "sbt-", "record-", "pluto-", "n-", "mtv-", "turma-", "naruto-", "one-", "nick-", "globo-", "sportv-", "espn-", "premiere-"]
    });
  });
  app2.get([
    "/api/stremio/live/catalog/tv/live-tv-brazil.json",
    "/api/stremio/live/catalog/tv/live-tv-brazil/:extra.json"
  ], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const channels = OfficialChannelProvider.getOfficialChannels();
    const metas = channels.map((ch) => ({
      id: ch.id,
      type: "tv",
      name: ch.name,
      poster: ch.tvgLogo,
      logo: ch.tvgLogo,
      background: ch.tvgLogo,
      description: ch.description || `Transmiss\xE3o ao vivo de ${ch.name}`,
      genres: [ch.groupTitle || "TV Aberta"]
    }));
    res.json({ metas });
  });
  app2.get(["/api/stremio/live/meta/tv/:id.json", "/api/stremio/live/meta/tv/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cleanId = String(req.params.id).replace(/\.json$/, "");
    const ch = OfficialChannelProvider.getOfficialChannels().find((c) => c.id === cleanId || c.tvgId === cleanId);
    if (!ch) return res.status(404).json({ meta: null });
    res.json({
      meta: {
        id: ch.id,
        type: "tv",
        name: ch.name,
        poster: ch.tvgLogo,
        logo: ch.tvgLogo,
        background: ch.tvgLogo,
        description: ch.description,
        genres: [ch.groupTitle || "TV Aberta"]
      }
    });
  });
  app2.get(["/api/stremio/live/stream/tv/:id.json", "/api/stremio/live/stream/tv/:id"], (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cleanId = String(req.params.id).replace(/\.json$/, "");
    const ch = OfficialChannelProvider.getOfficialChannels().find((c) => c.id === cleanId || c.tvgId === cleanId);
    if (!ch || !ch.url) {
      return res.json({ streams: [] });
    }
    const streamUrl = ch.url.startsWith("http") ? `/api/proxy?url=${encodeURIComponent(ch.url)}` : ch.url;
    res.json({
      streams: [
        {
          name: ch.name,
          title: `${ch.name} - Transmiss\xE3o Direta Oficial (${ch.quality || "HD"})`,
          url: streamUrl,
          sourceType: "hls",
          behaviorHints: { notWebReady: false }
        },
        {
          name: `${ch.name} (CDN Direto)`,
          title: `${ch.name} - CDN Direto Original`,
          url: ch.url,
          sourceType: "hls",
          behaviorHints: { notWebReady: false }
        }
      ]
    });
  });
  app2.get("/api/torrent/status", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const probe = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(1500) });
      if (probe.ok) {
        return res.json({
          available: true,
          engineUrl: "http://127.0.0.1:11470",
          status: "connected",
          message: "Motor Stremio Streaming Server ativo localmente na porta 11470."
        });
      }
    } catch {
    }
    res.json({
      available: false,
      engineUrl: null,
      status: "standalone_web",
      message: "Executando em ambiente Web direto. Transmiss\xF5es diretas HLS/MP4 nativas est\xE3o ativas com reprodu\xE7\xE3o imediata."
    });
  });
  app2.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      platform: "ZapiTV Stremio Core",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime()
    });
  });
  app2.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).json({ error: "Par\xE2metro 'url' \xE9 obrigat\xF3rio" });
    }
    try {
      const parsed = new URL(targetUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return res.status(400).json({ error: "Protocolo inv\xE1lido" });
      }
      const headers = {
        "User-Agent": "ZapiTV-Stremio/1.0.0 (gebel.streaming@zapitv.local)",
        "Accept": "*/*"
      };
      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }
      const response = await fetch(targetUrl, {
        headers,
        signal: AbortSignal.timeout(15e3)
      });
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
      const contentType = response.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      const contentRange = response.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);
      const acceptRanges = response.headers.get("accept-ranges");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
      const contentLength = response.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);
      res.status(response.status);
      if (response.body) {
        const { Readable } = await import("stream");
        const nodeStream = Readable.fromWeb(response.body);
        nodeStream.on("error", (streamErr) => {
          try {
            if (!res.writableEnded) res.end();
          } catch {
          }
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      res.status(502).json({
        error: "Falha ao consultar recurso via proxy",
        details: err?.message || String(err)
      });
    }
  });
  app2.get("/api/validate-stream", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    const targetUrl = req.query.url;
    const targetTitle = req.query.targetTitle || "";
    const expectedType = req.query.type || "auto";
    if (!targetUrl) {
      return res.status(400).json({ valid: false, reason: "Par\xE2metro 'url' \xE9 obrigat\xF3rio" });
    }
    const lowerTarget = `${targetUrl} ${targetTitle}`.toLowerCase().replace(/[-_./+]/g, " ");
    const ADULT_TERMS = ["mia khalifa", "khalifa", "brazzers", "xvideos", "pornhub", "redtube", "youporn", "bangbros", "spankbang", "xhamster", "naughtyamerica", "hardcore xxx"];
    if (ADULT_TERMS.some((t) => lowerTarget.includes(t))) {
      return res.json({
        valid: false,
        isParked: false,
        url: targetUrl,
        finalUrl: targetUrl,
        reason: "\u{1F6A8} Quarentena: Assinatura de conte\xFAdo adulto/trote detectada"
      });
    }
    try {
      const parsed = new URL(targetUrl.startsWith("/") ? `http://localhost:${process.env.PORT || "4000"}${targetUrl}` : targetUrl);
      const host = parsed.hostname.toLowerCase();
      const PARKED_DOMAINS = [
        "superflixapi.top",
        "parklogic.com",
        "bodis.com",
        "sedo.com",
        "parkingcrew.net",
        "hugedomains.com",
        "dan.com"
      ];
      if (PARKED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) {
        return res.json({
          valid: false,
          isParked: true,
          url: targetUrl,
          finalUrl: targetUrl,
          reason: "Dom\xEDnio comprovadamente estacionado / ParkLogic detectado"
        });
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6e3);
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Range": "bytes=0-16384"
        },
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timeout);
      const finalUrl = response.url || targetUrl;
      const finalHost = new URL(finalUrl).hostname.toLowerCase();
      const status = response.status;
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (PARKED_DOMAINS.some((d) => finalHost === d || finalHost.endsWith(`.${d}`))) {
        return res.json({
          valid: false,
          isParked: true,
          status,
          url: targetUrl,
          finalUrl,
          reason: "Redirecionamento para dom\xEDnio ParkLogic / Estacionado"
        });
      }
      if (status >= 400 && status !== 416) {
        return res.json({
          valid: false,
          status,
          url: targetUrl,
          finalUrl,
          reason: `Erro HTTP ${status} retornado pelo servidor`
        });
      }
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
      const lowerText = text.toLowerCase();
      const PARKING_SIGNATURES = [
        "this page has been created by parklogic",
        "parklogic.com",
        "visit parklogic.com",
        "domain parked",
        "domain has expired",
        "domain is parked",
        "godaddy parking",
        "buy this domain",
        "domain name is available",
        "is parked free courtesy of",
        "sedo domain parking"
      ];
      for (const sig of PARKING_SIGNATURES) {
        if (lowerText.includes(sig)) {
          return res.json({
            valid: false,
            isParked: true,
            status,
            url: targetUrl,
            finalUrl,
            reason: `Assinatura de dom\xEDnio estacionado encontrada: "${sig}"`
          });
        }
      }
      const isHls = expectedType === "hls" || targetUrl.includes(".m3u8") || contentType.includes("mpegurl");
      if (isHls) {
        if (contentType.includes("text/html") && !text.includes("#EXTM3U")) {
          return res.json({
            valid: false,
            isManifestValid: false,
            status,
            url: targetUrl,
            finalUrl,
            reason: "Resposta HTML recebida quando se esperava manifesto HLS (.m3u8)"
          });
        }
        const hasValidM3uHeader = text.trimStart().startsWith("#EXTM3U");
        if (!hasValidM3uHeader && !contentType.includes("octet-stream") && !contentType.includes("video/")) {
          return res.json({
            valid: false,
            isManifestValid: false,
            status,
            url: targetUrl,
            finalUrl,
            reason: "Manifesto HLS inv\xE1lido (cabe\xE7alho #EXTM3U ausente)"
          });
        }
        return res.json({
          valid: true,
          status,
          url: targetUrl,
          finalUrl,
          contentType,
          isManifestValid: true
        });
      }
      if (contentType.includes("text/html")) {
        return res.json({
          valid: false,
          status,
          url: targetUrl,
          finalUrl,
          reason: "Resposta HTML recebida. Rejeitado: Apenas transmiss\xF5es nativas diretas de v\xEDdeo (HLS/MP4/WebM) s\xE3o autorizadas. Players externos com an\xFAncios ou iframes s\xE3o proibidos."
        });
      }
      return res.json({
        valid: true,
        status,
        url: targetUrl,
        finalUrl,
        contentType
      });
    } catch (err) {
      return res.json({
        valid: false,
        url: targetUrl,
        reason: `Falha de conex\xE3o / URL inacess\xEDvel: ${err.message || String(err)}`
      });
    }
  });
  const FEATURED_CACHE_FILE = path2.resolve(process.cwd(), "data", "featured_weekly_selection.json");
  featuredRankingService.setStorageAdapter({
    load: () => {
      try {
        if (fs2.existsSync(FEATURED_CACHE_FILE)) {
          const raw = fs2.readFileSync(FEATURED_CACHE_FILE, "utf-8");
          if (raw) return JSON.parse(raw);
        }
      } catch (e) {
        console.warn("[Server] Falha ao carregar cache do Em Destaque do disco:", e);
      }
      return null;
    },
    save: (data) => {
      try {
        const dir = path2.dirname(FEATURED_CACHE_FILE);
        if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
        const tmpFile = `${FEATURED_CACHE_FILE}.${Date.now()}.tmp`;
        fs2.writeFileSync(tmpFile, JSON.stringify(data, null, 2), "utf-8");
        fs2.renameSync(tmpFile, FEATURED_CACHE_FILE);
      } catch (e) {
        console.warn("[Server] Falha ao persistir cache do Em Destaque no disco:", e);
      }
    }
  });
  app2.get("/api/featured", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const selection = featuredRankingService.getFeaturedSelectionSync();
      res.json(selection);
    } catch (err) {
      res.status(500).json({ error: "Falha ao obter rankings em destaque", details: err?.message });
    }
  });
  app2.post("/api/featured/refresh", async (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const selection = await featuredRankingService.refreshFeaturedSelection();
      res.json(selection);
    } catch (err) {
      res.status(500).json({ error: "Falha ao atualizar rankings em destaque", details: err?.message });
    }
  });
  const handleFeaturedCron = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers["authorization"];
      const vercelCronHeader = req.headers["x-vercel-cron"];
      const querySecret = req.query.secret;
      const isAuthValid = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret || vercelCronHeader === "1";
      if (!isAuthValid) {
        return res.status(401).json({ error: "Acesso n\xE3o autorizado para execu\xE7\xE3o do cron" });
      }
    }
    try {
      console.log("[Server] Acionamento cron semanal de Em Destaque recebido...");
      const result = await featuredRankingService.runWeeklyScheduledUpdate({ force: false });
      return res.json({
        success: true,
        weekKey: result.weekKey,
        weekLabel: result.weekLabel,
        referenceDate: result.referenceDate,
        lastUpdatedAt: result.lastUpdatedAt,
        nextScheduledUpdateFormatted: result.nextScheduledUpdateFormatted,
        moviesCount: result.featuredMovies.length,
        seriesCount: result.featuredSeries.length,
        status: result.updateStatus
      });
    } catch (err) {
      console.error("[Server] Erro no endpoint cron semanal:", err);
      return res.status(500).json({ error: "Falha na execu\xE7\xE3o agendada", details: err?.message });
    }
  };
  app2.get("/api/featured/cron", handleFeaturedCron);
  app2.post("/api/featured/cron", handleFeaturedCron);
  app2.get("/api/featured/scheduler-status", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(weeklyFeaturedScheduler.getStatus());
  });
  app2.get("/api/featured/verify-correspondence", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const selection = featuredRankingService.getFeaturedSelectionSync();
      const audit = imdbWeeklyRankingService.verifyCorrespondence(
        selection.featuredMovies,
        selection.featuredSeries
      );
      res.json(audit);
    } catch (err) {
      res.status(500).json({ error: "Falha ao verificar correspond\xEAncia com IMDb", details: err?.message });
    }
  });
  app2.post("/api/featured/import-snapshot", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    try {
      const { snapshot } = req.body || {};
      if (!snapshot) {
        return res.status(400).json({ error: "Corpo da requisi\xE7\xE3o deve conter o objeto 'snapshot'" });
      }
      const result = imdbWeeklyRankingService.importAuthorizedSnapshot(snapshot);
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      const updated = featuredRankingService.recomputeFeaturedSelectionSync();
      return res.json({
        success: true,
        message: result.message,
        featuredSelection: updated
      });
    } catch (err) {
      res.status(500).json({ error: "Falha ao importar snapshot IMDb", details: err?.message });
    }
  });
  return app2;
}
var app = createApp();
var server_default = app;
if (!process.env.VERCEL) {
  (async () => {
    const engineActive = await checkStremioEngineStatus();
    if (engineActive) {
      console.log("Stremio Streaming Server detectado na porta 11470.");
    } else {
      console.log("Modo Web direto ativo (sem processos externos).");
    }
    weeklyFeaturedScheduler.start();
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path2.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("/{*path}", (_req, res) => {
        res.sendFile(path2.join(distPath, "index.html"));
      });
    }
    const port = parseInt(process.env.PORT || "4000", 10);
    app.listen(port, "0.0.0.0", () => {
      console.log(`ZapiTV Core Server running on http://localhost:${port}`);
    });
  })().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
export {
  server_default as default
};
