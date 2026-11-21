import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { if (import.meta.env?.DEV) console.error(error); }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-navy-700">An unexpected error stopped this page from loading. Your information on the server is safe. Please reload and try again.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-navy-900 px-5 text-sm font-medium text-white hover:bg-navy-800">Reload the page</button>
      </div>
    );
  }
}
