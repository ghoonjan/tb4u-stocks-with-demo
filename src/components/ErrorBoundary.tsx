import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary. Prevents a single uncaught render error from
 * blanking the entire app in production (where stack traces are stripped).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to console so it's visible in production browser devtools.
    console.error("[ErrorBoundary] Uncaught render error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-background text-foreground"
      >
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The page hit an unexpected error and couldn't render. Try refreshing —
            if it keeps happening, the issue has been logged to the browser console.
          </p>
          {this.state.error?.message && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <button
          type="button"
          onClick={this.handleReload}
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          Reload page
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
