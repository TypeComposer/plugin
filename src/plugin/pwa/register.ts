import { TypeComposerPWA } from ".";
import { notification } from "./notification";


export function register(options: TypeComposerPWA.PWDOptions, indexjs: string) {
  return {
    fileName: 'register-sw.js',
    code: `

        window.addEventListener('load', () => {
            loadpage();
            registerSW();
          });
          
          async function loadpage() {
            Notification.requestPermission();
            const res = await fetch('${indexjs}');
            console.log("loadpage: ", res);
          }
          
          async function registerSW() {
            if ('serviceWorker' in navigator) {
              try {
                await navigator.serviceWorker.register('./sw.js');
              } catch (e) {
                console.log('SW registration failed');
              }
            }

            ${notification().code}
    
          }

    `}

}