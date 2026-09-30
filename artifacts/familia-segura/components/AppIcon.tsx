import { Icon } from '@/components/Icon';
import { StyleSheet, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type AppIconProps = {
  name: string;
  color: string;
  size?: number;
};

export function AppIcon({ name, color, size = 44 }: AppIconProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: `${color}18` }]}>
      <Icon name={name as React.ComponentProps<typeof Icon>['name']} size={size * 0.45} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});