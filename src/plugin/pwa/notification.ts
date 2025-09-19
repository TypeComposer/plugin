

export function notification() {


    const a =

    {
        fileName: 'notification-sw.js',
        code: `
        if ('Notification' in window) {
            const permissaoNotificacao = Notification.permission;
          
            if (permissaoNotificacao === 'granted') {
              // O usuário já concedeu permissão para notificações
              console.log('Permissão já concedida para notificações');
            } else if (permissaoNotificacao !== 'denied') {
              // A permissão ainda não foi concedida ou negada, então solicitamos ao usuário
              Notification.requestPermission().then((permissao) => {
                if (permissao === 'granted') {
                  console.log('Permissão concedida para notificações');
                  // Agora você pode exibir notificações
                  mostrarNotificacao();
                } else {
                  console.warn('Permissão negada para notificações');
                }
              });
            }
          }
    `}

    a.code = ''
    return a
}