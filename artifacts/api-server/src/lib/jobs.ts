/**
 * Tarefas periódicas: uma execução por vez neste processo. Se a anterior ainda não terminou (banco lento),
 * a nova é pulada em vez de empilhar. Entre instâncias, cada tarefa já é segura (update ... returning / marcação).
 */
export function singleFlight(task: () => Promise<unknown>) {
  let running = false;
  return () => {
    if (running) return;
    running = true;
    void task().finally(() => { running = false; });
  };
}

const timers = new Set<NodeJS.Timeout>();

/** Agenda uma tarefa periódica; stopJobs() cancela todas no desligamento. */
export function every(ms: number, task: () => void) {
  const timer = setInterval(task, ms);
  timer.unref();
  timers.add(timer);
}

export function after(ms: number, task: () => void) {
  const timer = setTimeout(task, ms);
  timer.unref();
  timers.add(timer);
}

export function stopJobs() {
  for (const timer of timers) clearInterval(timer);
  timers.clear();
}
