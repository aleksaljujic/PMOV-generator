// Owned by T09. Error boundary so a failing child module cannot take the whole shell down.
import { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  name: string;
  fallback?: ReactNode;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class SafeBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.warn(`[${this.props.name}]`, error.message);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="boundary-fallback" role="alert">
            {this.props.name}: {this.state.error.message}
          </div>
        )
      );
    }
    return this.props.children;
  }
}
