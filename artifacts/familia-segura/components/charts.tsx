import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { formatMinutes } from '@/components/ui';

/**
 * Gráficos do responsável (react-native-svg, sem dependência extra).
 * Regras: um eixo só; série única sem legenda (o título nomeia); cor da criança fixa por identidade
 * e sempre com o nome escrito ao lado; toque mostra o valor exato; cada gráfico tem descrição acessível.
 */

const DARK_COUNTERPART: Record<string, string> = {
  '#2a78d6': '#3987e5', '#eb6834': '#d95926', '#1baf7a': '#199e70', '#eda100': '#c98500',
  '#e87ba4': '#d55181', '#008300': '#008300', '#4a3aa7': '#9085e9', '#e34948': '#e66767',
};

/** Mesma criança, tom ajustado ao tema escuro (a identidade não muda). */
export function useChildColor() {
  const scheme = useColorScheme();
  return (hex: string) => (scheme === 'dark' ? DARK_COUNTERPART[hex.toLowerCase()] ?? hex : hex);
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
};

/** Uso por dia (barras) com o limite do dia como linha de referência tracejada. */
export function DailyUsageChart({ days, height = 170 }: { days: Array<{ date: string; minutes: number; limitMinutes: number }>; height?: number }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(60, ...days.map((d) => Math.max(d.minutes, d.limitMinutes)));
  const top = 14, bottom = 22;
  const plotH = height - top - bottom;
  const slot = days.length ? width / days.length : 0;
  const barW = Math.max(4, Math.min(28, slot - 6));
  const y = (m: number) => top + plotH - (m / max) * plotH;
  const labelEvery = days.length > 10 ? Math.ceil(days.length / 7) : 1;
  const selected = active !== null ? days[active] : null;
  const summary = days.map((d) => `${dayLabel(d.date)}: ${formatMinutes(d.minutes)}`).join('; ');

  return (
    <View accessible accessibilityLabel={`Uso por dia. ${summary}`} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text style={[styles.tooltip, { color: selected ? colors.foreground : colors.mutedForeground }]}>
        {selected ? `${dayLabel(selected.date)} · ${formatMinutes(selected.minutes)} (limite ${formatMinutes(selected.limitMinutes)})` : 'Toque em um dia para ver o total'}
      </Text>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0.5, 1].map((f) => (
            <Line key={f} x1={0} x2={width} y1={y(max * f)} y2={y(max * f)} stroke={colors.chartGrid} strokeWidth={1} />
          ))}
          <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
          {days.map((d, i) => {
            const x = i * slot + (slot - barW) / 2;
            const h = Math.max(d.minutes > 0 ? 3 : 0, (d.minutes / max) * plotH);
            const over = d.limitMinutes > 0 && d.minutes >= d.limitMinutes;
            return (
              <React.Fragment key={d.date}>
                <Rect x={x} y={top + plotH - h} width={barW} height={h} rx={4}
                  fill={active === null || active === i ? colors.chartBar : colors.chartBarMuted} />
                {d.limitMinutes > 0 && (
                  <Line x1={i * slot + 2} x2={(i + 1) * slot - 2} y1={y(d.limitMinutes)} y2={y(d.limitMinutes)}
                    stroke={colors.chartLimit} strokeWidth={2} strokeDasharray="4 3" />
                )}
                {over && <Rect x={x + barW / 2 - 3} y={top + plotH - h - 9} width={6} height={6} rx={3} fill={colors.chartLimit} />}
                {i % labelEvery === 0 && (
                  <SvgText x={i * slot + slot / 2} y={height - 6} fontSize={10} fontFamily="Inter_500Medium, Inter, system-ui, sans-serif" fill={colors.mutedForeground} textAnchor="middle">
                    {days.length > 10 ? String(new Date(`${d.date}T12:00:00`).getDate()) : WEEKDAYS[new Date(`${d.date}T12:00:00`).getDay()]}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      )}
      {width > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.hitRow, { top: 20 }]}>
          {days.map((d, i) => (
            <Pressable key={d.date} style={{ width: slot, height: '100%' }} onPress={() => setActive(active === i ? null : i)}
              accessibilityRole="button" accessibilityLabel={`${dayLabel(d.date)}: ${formatMinutes(d.minutes)}`} />
          ))}
        </View>
      )}
      <View style={styles.legendRow}>
        <View style={[styles.legendDash, { borderColor: colors.chartLimit }]} />
        <Text style={[styles.legendText, { color: colors.mutedForeground }]}>limite do dia (inclui tempo extra)</Text>
      </View>
    </View>
  );
}

/** Ranking horizontal (apps, aparelhos, crianças). Rótulo e valor sempre escritos. */
export function RankBars({ items, emptyText }: {
  items: Array<{ key: string; label: string; minutes: number; color?: string; note?: string }>; emptyText: string;
}) {
  const colors = useColors();
  if (items.length === 0) return <Text style={[styles.empty, { color: colors.mutedForeground }]}>{emptyText}</Text>;
  const max = Math.max(...items.map((i) => i.minutes), 1);
  return (
    <View style={{ gap: 12 }}>
      {items.map((item) => (
        <View key={item.key} accessible accessibilityLabel={`${item.label}: ${formatMinutes(item.minutes)}${item.note ? `, ${item.note}` : ''}`}>
          <View style={styles.rankHead}>
            <Text style={[styles.rankLabel, { color: colors.foreground }]} numberOfLines={1}>{item.label}</Text>
            <Text style={[styles.rankValue, { color: colors.foreground }]}>{formatMinutes(item.minutes)}</Text>
          </View>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View style={[styles.fill, { width: `${Math.max(2, (item.minutes / max) * 100)}%`, backgroundColor: item.color ?? colors.chartBar }]} />
          </View>
          {item.note ? <Text style={[styles.note, { color: colors.mutedForeground }]}>{item.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Mapa de calor dia da semana × hora (uma matiz, claro → escuro). */
export function UsageHeatmap({ cells }: { cells: Array<{ weekday: number; hour: number; minutes: number }> }) {
  const colors = useColors();
  const [active, setActive] = useState<{ weekday: number; hour: number; minutes: number } | null>(null);
  const grid = new Map(cells.map((c) => [`${c.weekday}:${c.hour}`, c.minutes]));
  const max = Math.max(1, ...cells.map((c) => c.minutes));
  const mix = (t: number) => blend(colors.chartHeatLow, colors.chartHeatHigh, t);
  const busiest = [...cells].sort((a, b) => b.minutes - a.minutes)[0];

  return (
    <View accessible accessibilityLabel={busiest ? `Horário de maior uso: ${WEEKDAYS[busiest.weekday]} às ${busiest.hour}h, ${formatMinutes(busiest.minutes)}` : 'Sem uso registrado'}>
      <Text style={[styles.tooltip, { color: active ? colors.foreground : colors.mutedForeground }]}>
        {active ? `${WEEKDAYS[active.weekday]}, ${active.hour}h–${active.hour + 1}h · ${formatMinutes(active.minutes)}` : 'Toque em um quadrado para ver o horário'}
      </Text>
      {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
        <View key={weekday} style={styles.heatRow}>
          <Text style={[styles.heatDay, { color: colors.mutedForeground }]}>{WEEKDAYS[weekday]}</Text>
          {Array.from({ length: 24 }, (_, hour) => {
            const minutes = grid.get(`${weekday}:${hour}`) ?? 0;
            const isActive = active?.weekday === weekday && active.hour === hour;
            return (
              <Pressable key={hour} onPress={() => setActive(isActive ? null : { weekday, hour, minutes })}
                style={[styles.heatCell, { backgroundColor: minutes ? mix(Math.sqrt(minutes / max)) : colors.chartHeatLow, borderColor: isActive ? colors.foreground : colors.card }]} />
            );
          })}
        </View>
      ))}
      <View style={styles.heatAxis}>
        {['0h', '6h', '12h', '18h', '23h'].map((l) => <Text key={l} style={[styles.heatAxisText, { color: colors.mutedForeground }]}>{l}</Text>)}
      </View>
    </View>
  );
}

/** Número em destaque com comparação ao período anterior. */
export function StatTile({ label, value, delta }: { label: string; value: string; delta?: { text: string; good: boolean } }) {
  const colors = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      {delta ? <Text style={[styles.statDelta, { color: delta.good ? colors.success : colors.warning }]}>{delta.text}</Text> : null}
    </View>
  );
}

function blend(a: string, b: string, t: number) {
  const pa = hex(a), pb = hex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.min(1, Math.max(0, t))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
function hex(h: string) {
  const v = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

const styles = StyleSheet.create({
  tooltip: { fontFamily: 'Inter_500Medium', fontSize: 12, marginBottom: 6, minHeight: 16 },
  hitRow: { flexDirection: 'row', bottom: 40 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  legendDash: { width: 16, borderTopWidth: 2, borderStyle: 'dashed' },
  legendText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  rankHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, gap: 8 },
  rankLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },
  rankValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  heatRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  heatDay: { width: 30, fontFamily: 'Inter_500Medium', fontSize: 10 },
  heatCell: { flex: 1, aspectRatio: 1, marginHorizontal: 0.5, borderRadius: 2, borderWidth: 1, maxHeight: 16 },
  heatAxis: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: 30, marginTop: 4 },
  heatAxisText: { fontFamily: 'Inter_400Regular', fontSize: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  statDelta: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
});
