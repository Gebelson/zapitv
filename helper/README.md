# ZapiTV Helper (Windows)

Extraia o ZIP, instale Node.js 20 ou superior e execute `iniciar-windows.cmd`. Mantenha a janela aberta durante os downloads e o uso da biblioteca. O código de pareamento aparece nessa janela. Na página Downloads do ZapiTV, digite o código para conectar.

Os vídeos autorizados são gravados em `Vídeos/ZapiTV` do seu usuário. Para escolher outra pasta, defina a variável `ZAPITV_HELPER_DIR` antes de iniciar. O Helper escuta somente em `127.0.0.1:19573`; não abre a porta na rede.

Esta versão transfere arquivos HTTP/HTTPS MP4/WebM autorizados, com retomada quando a origem suporta Range. Ao reiniciar, tarefas parciais ficam pausadas: abra novamente os detalhes e clique em Baixar para fornecer uma URL atualizada. Torrent, HLS/DASH, fontes com DRM ou autorização desconhecida não são oferecidos pelo Helper. O navegador precisa permitir acesso da página HTTPS ao serviço local. Windows é a única plataforma testada até agora.

Para encerrar, feche a janela. A opção **Desconectar** no ZapiTV revoga o token de pareamento da sessão atual. Ao reiniciar o Helper, o token é recriado.
