import { Alert as NativeAlert, Platform } from 'react-native';

type AlertButton = { text?: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };

/**
 * Alert que também funciona no navegador (modo demonstração / web): lá o Alert do React Native não aparece.
 * Com mais de um botão vira um "confirmar"; a ação é o primeiro botão que não é "cancelar".
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') {
      NativeAlert.alert(title, message, buttons);
      return;
    }
    const text = message ? `${title}\n\n${message}` : title;
    const action = buttons?.find((b) => b.style !== 'cancel' && b.onPress);
    if (action && buttons && buttons.length > 1) {
      if (window.confirm(text)) action.onPress?.();
      return;
    }
    window.alert(text);
    buttons?.[0]?.onPress?.();
  },
};
