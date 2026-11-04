import { useEffect, useState } from 'react';
import { EXAMPLES, loadExample } from './load/examples';
import { Model } from './model/model';
import { Brand, ThemeToggle } from './ui/Chrome';
import { Viewer } from './Viewer';

type State =
  | { status: 'loading' }
  | { status: 'ready'; model: Model }
  | { status: 'unknown' }
  | { status: 'failed'; problem: string; details: string[] };

function Landing({ notice }: { notice?: React.ReactNode }) {
  return (
    <div className="landing">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Brand /><ThemeToggle /></div>
      <h1>Open an Architecture Graph</h1>
      {notice}
      <p className="muted">The viewer shows a graph's module map, each module's contracts and their consumers, contract structure and examples, and every node and relationship. Graphs are read inside this browser tab; nothing is uploaded.</p>
      <div className="cards">
        {EXAMPLES.map(example => (
          <a key={example.name} className="card" href={`?example=${encodeURIComponent(example.name)}`}>
            <b>{example.title}</b>
            <span>{example.summary}</span>
          </a>
        ))}
      </div>
      <p className="muted">This version opens the bundled examples. Opening your own graph from a URL or a project folder is planned.</p>
    </div>
  );
}

export function App() {
  const name = new URLSearchParams(location.search).get('example');
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    if (!name) return;
    let current = true;
    loadExample(name).then(
      result => {
        if (!current) return;
        if (!result) setState({ status: 'unknown' });
        else if ('problem' in result && result.problem !== undefined) {
          setState({ status: 'failed', problem: result.problem, details: result.diagnostics.map(item => `${item.code} ${item.at}: ${item.message}`) });
        } else setState({ status: 'ready', model: new Model(result as Exclude<typeof result, { problem: string }>) });
      },
      (error: unknown) => { if (current) setState({ status: 'failed', problem: error instanceof Error ? error.message : String(error), details: [] }); },
    );
    return () => { current = false; };
  }, [name]);

  if (!name) return <Landing />;
  if (state.status === 'unknown') return <Landing notice={<p className="gap">There is no bundled example called “{name}”. Choose one of these.</p>} />;
  if (state.status === 'failed') {
    return (
      <Landing notice={(
        <div className="gap">
          <p>{state.problem}</p>
          {state.details.length > 0 && <ul>{state.details.map(line => <li key={line} className="mono">{line}</li>)}</ul>}
        </div>
      )} />
    );
  }
  if (state.status === 'loading') return <div className="status-line" role="status">Opening {name}…</div>;
  return <Viewer model={state.model} examples={EXAMPLES} example={name} />;
}
