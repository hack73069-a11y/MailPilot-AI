export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration: number;
  action?: ToastAction;
  createdAt: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, any> = new Map();

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  public subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public show(type: ToastType, message: string, options?: ToastOptions): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const duration = options?.duration ?? 4200;

    const newToast: ToastItem = {
      id,
      type,
      title: options?.title,
      message,
      duration,
      action: options?.action,
      createdAt: Date.now(),
    };

    // Keep at most 4 toasts visible at a time
    this.toasts = [newToast, ...this.toasts.slice(0, 3)];
    this.notify();

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  public dismiss(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public success(message: string, options?: ToastOptions) {
    return this.show('success', message, options);
  }

  public error(message: string, options?: ToastOptions) {
    return this.show('error', message, options);
  }

  public info(message: string, options?: ToastOptions) {
    return this.show('info', message, options);
  }

  public warning(message: string, options?: ToastOptions) {
    return this.show('warning', message, options);
  }

  public clearAll() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();
