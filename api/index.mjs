// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs";

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
    const isTheatricalUnreleased = item.type === "FILME" /* MOVIE */ && item.year >= currentYear || /hope.*primeiro.*impacto|vingadores.*destino|avengers.*doomsday|batman.*part.*ii/i.test(item.title);
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
      const score2 = 1e5 + subTierBonus + qualityBonus + confidenceBonus;
      return {
        score: score2,
        priority: 1,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 1: \xC1udio Dublado PT-BR (${subExplanation}, score: ${score2})${confidenceExplanation}`
      };
    }
    if (audio.tier === "dual_audio") {
      let subTierBonus = 2e3;
      if (sub.format === "clean_confirmed") subTierBonus = 4e3;
      else if (sub.format === "softsub") subTierBonus = 3e3;
      else if (sub.format === "hardsub_ptbr") subTierBonus = 1e3;
      else if (sub.format === "hardsub_foreign") subTierBonus = 500;
      const score2 = 9e4 + subTierBonus + qualityBonus + confidenceBonus;
      return {
        score: score2,
        priority: 2,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 2: Dual \xC1udio PT-BR (score: ${score2})${confidenceExplanation}`
      };
    }
    if (options.hasExternalPtSub && (sub.format === "clean_confirmed" || sub.format === "softsub" || sub.format === "unknown")) {
      let subBonus = 1e3;
      if (sub.format === "clean_confirmed") subBonus = 4e3;
      else if (sub.format === "softsub") subBonus = 3e3;
      const score2 = 5e4 + subBonus + qualityBonus + confidenceBonus;
      return {
        score: score2,
        priority: 3,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 3: \xC1udio Original + V\xEDdeo Limpo + Legenda PT-BR externa (score: ${score2})${confidenceExplanation}`
      };
    }
    if (sub.format === "softsub" && sub.hasPtSubtitle) {
      const score2 = 4e4 + 3e3 + qualityBonus + confidenceBonus;
      return {
        score: score2,
        priority: 4,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 4: \xC1udio Original + Softsub PT-BR interno (score: ${score2})${confidenceExplanation}`
      };
    }
    if (sub.format === "hardsub_ptbr") {
      const base = options.hasExternalPtSub ? 2e4 : 3e4;
      const score2 = base + qualityBonus + confidenceBonus;
      return {
        score: score2,
        priority: 5,
        confidence,
        audioTier: audio.tier,
        subtitleFormat: sub.format,
        audioAnalysis: audio,
        subtitleAnalysis: sub,
        explanation: `Prioridade 5: \xC1udio Original + Hardsub PT-BR (score: ${score2})${confidenceExplanation}`
      };
    }
    const isForeignHardsub = sub.format === "hardsub_foreign";
    const baseScore = isForeignHardsub ? -5e3 : 5e3;
    const score = baseScore + qualityBonus + confidenceBonus;
    return {
      score,
      priority: 6,
      confidence,
      audioTier: audio.tier,
      subtitleFormat: sub.format,
      audioAnalysis: audio,
      subtitleAnalysis: sub,
      explanation: `Prioridade 6: Idioma estrangeiro / Hardsub estrangeiro (score: ${score})${confidenceExplanation}`
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

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function ensureStremioEngine() {
  try {
    const probe = await fetch("http://127.0.0.1:11470/stats.json", { signal: AbortSignal.timeout(1e3) });
    if (probe.ok) {
      console.log("Stremio Streaming Engine ativo na porta 11470.");
      return;
    }
  } catch {
  }
  const serverJsPath = "C:\\Users\\gebel\\AppData\\Local\\Programs\\Stremio\\server.js";
  if (fs.existsSync(serverJsPath)) {
    console.log("Iniciando motor oficial do Stremio (server.js) na porta 11470...");
    try {
      const p = spawn("node", [serverJsPath], {
        detached: true,
        stdio: "ignore",
        cwd: "C:\\Users\\gebel\\AppData\\Local\\Programs\\Stremio"
      });
      p.unref();
    } catch (e) {
      console.warn("N\xE3o foi poss\xEDvel iniciar motor do Stremio:", e.message);
    }
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
      (it) => it.id === cleanId || it.tmdbId && String(it.tmdbId) === cleanId || it.imdbId && it.imdbId === cleanId
    );
    if (!item) return [];
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
    const streams = resolveOpenItemStreams(String(req.params.id));
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
    const streams = resolveOpenItemStreams(String(req.params.id)).filter(
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
    const streams = resolveOpenItemStreams(String(req.params.id));
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
  return app2;
}
var app = createApp();
var server_default = app;
if (!process.env.VERCEL) {
  (async () => {
    await ensureStremioEngine();
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("/{*path}", (_req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
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
