import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';

const API = 'http://localhost:3001';

function panel(title, children) {
  return (
    <section style={{ border: '1px solid #1d5034', background: '#0d1913', padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: '#ffd66d', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>{title}</div>
      {children}
    </section>
  );
}

function LoginScreen({ onLoggedIn }) {
  const [roles, setRoles] = useState(null);
  const [name, setName] = useState('');
  const [team, setTeam] = useState('blue');
  const [roleKey, setRoleKey] = useState('soc');
  const [roomId, setRoomId] = useState('alpha');
  const [stats, setStats] = useState({ analysis: 4, identity: 3, telemetry: 3 });
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/meta/roles`).then((r) => r.json()).then(setRoles);
  }, []);

  const role = roles?.[team]?.find((r) => r.key === roleKey);

  useEffect(() => {
    if (!role) return;
    const base = {};
    role.skills.forEach((s, idx) => { base[s] = idx === 0 ? 4 : 3; });
    setStats(base);
  }, [roleKey, team, roles]);

  const remaining = useMemo(() => {
    if (!role) return 0;
    return role.statPoints - Object.values(stats).reduce((a, b) => a + Number(b || 0), 0);
  }, [role, stats]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, team, roleKey, roomId, stats })
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Login failed');
    onLoggedIn({ token: data.token, roomId, name, team, roleKey, stats });
  }

  if (!roles) return <div style={{ padding: 24 }}>Loading roles...</div>;

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100%' }}>
      <form onSubmit={submit} style={{ width: 920, maxWidth: '92vw', border: '1px solid #1d5034', background: '#07110c', padding: 24 }}>
        <div style={{ color: '#68ff9d', fontSize: 28, letterSpacing: '0.18em', marginBottom: 8 }}>CYBERSEC OPS</div>
        <div style={{ color: '#86bb95', marginBottom: 24 }}>Per-player login and character build</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            {panel('Identity', <>
              <div style={{ marginBottom: 12 }}><input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} /></div>
              <div style={{ marginBottom: 12 }}><input placeholder="Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} style={inputStyle} /></div>
              <div style={{ marginBottom: 12 }}>
                <select value={team} onChange={(e) => { setTeam(e.target.value); setRoleKey(e.target.value === 'blue' ? 'soc' : 'recon'); }} style={inputStyle}>
                  <option value="blue">Blue Team</option>
                  <option value="red">Red Team</option>
                </select>
              </div>
              <div>
                <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} style={inputStyle}>
                  {roles[team].map((r) => <option key={r.key} value={r.key}>{r.role}</option>)}
                </select>
              </div>
            </>)}
            {role && panel('Role', <>
              <div style={{ color: '#68ff9d', fontWeight: 700 }}>{role.role}</div>
              <p style={{ lineHeight: 1.6 }}>{role.description}</p>
              <div>Commands: {Object.keys(role.commands).join(', ')}</div>
            </>)}
          </div>
          <div>
            {role && panel('Character Builder', <>
              <div style={{ marginBottom: 12 }}>Stat points remaining: <strong style={{ color: remaining < 0 ? '#ff8e8e' : '#68ff9d' }}>{remaining}</strong></div>
              {role.skills.map((skill) => (
                <div key={skill} style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                  <div>{skill}</div>
                  <input type="number" min="0" max="10" value={stats[skill] ?? 0} onChange={(e) => setStats({ ...stats, [skill]: Number(e.target.value) })} style={inputStyle} />
                </div>
              ))}
              <div style={{ color: '#86bb95', lineHeight: 1.6 }}>Your allocated skill values become roll modifiers for commands tied to that skill. Example: a high patching stat boosts deploy-patch rolls, and successful patching raises the difficulty of later red exploit actions.</div>
            </>)}
            {error && <div style={{ color: '#ff8e8e', marginBottom: 12 }}>{error}</div>}
            <button disabled={!name || remaining < 0} style={buttonStyle}>Enter Game</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  return session ? <GameScreen session={session} /> : <LoginScreen onLoggedIn={setSession} />;
}

function GameScreen({ session }) {
  const [view, setView] = useState(null);
  const [presence, setPresence] = useState([]);
  const [narrations, setNarrations] = useState([]);
  const [terminal, setTerminal] = useState([
    'CYBERSEC OPS TERMINAL READY',
    'Type help for commands. Press ArrowUp/ArrowDown for command history. Press Tab for autocomplete.'
  ]);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const socketRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    const socket = io(API, { auth: { token: session.token } });
    socketRef.current = socket;

    socket.on('room:view', setView);
    socket.on('room:presence', (msg) => setPresence(msg.players));
    socket.on('room:narration', (msg) => {
      setNarrations((n) => [msg, ...n].slice(0, 5));
      appendTerminal(msg.narration);
    });
    socket.on('room:event', (msg) => appendTerminal(`EVENT: ${msg.actor} submitted ${msg.command} -> ${msg.outcome}`));

    return () => socket.disconnect();
  }, [session.token]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminal]);

  function appendTerminal(text) {
    setTerminal((t) => [...t, text]);
  }

  function runCommand(raw) {
    const input = raw.trim();
    if (!input) return;
    appendTerminal(`> ${input}`);
    setHistory((h) => [...h, input]);
    setHistoryIndex(-1);

    const [cmd, ...rest] = input.split(' ');
    if (cmd === 'help') {
      appendTerminal('help\nstatus\nintel\nroles\nskills\nhistory\nsubmit <command>\nautocomplete <prefix>');
      return;
    }
    if (cmd === 'status') {
      appendTerminal(JSON.stringify({ round: view?.round, phase: view?.phase, me: view?.player, roomId: view?.roomId }, null, 2));
      return;
    }
    if (cmd === 'intel') {
      appendTerminal(JSON.stringify(view?.visibleIntel || {}, null, 2));
      return;
    }
    if (cmd === 'roles') {
      appendTerminal(Object.keys(view?.commandSet || {}).join('\n'));
      return;
    }
    if (cmd === 'skills') {
      appendTerminal(JSON.stringify(view?.player?.stats || {}, null, 2));
      return;
    }
    if (cmd === 'history') {
      appendTerminal((view?.history || []).map((h) => `Round ${h.round} ${h.phase}\n${h.narration}`).join('\n\n---\n\n') || 'No history yet');
      return;
    }
    if (cmd === 'autocomplete') {
      const prefix = rest.join(' ');
      socketRef.current.emit('command:autocomplete', prefix, (data) => appendTerminal(JSON.stringify(data, null, 2)));
      return;
    }
    if (cmd === 'submit') {
      const actual = rest.join(' ');
      socketRef.current.emit('command:submit', { command: actual }, (res) => appendTerminal(JSON.stringify(res, null, 2)));
      return;
    }
    appendTerminal('Unknown command');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(command);
      setCommand('');
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!history.length) return;
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setCommand(history[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!history.length) return;
      const next = historyIndex >= history.length - 1 ? -1 : historyIndex + 1;
      setHistoryIndex(next);
      setCommand(next === -1 ? '' : history[next]);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const text = command.startsWith('submit ') ? command.slice(7) : command;
      socketRef.current.emit('command:autocomplete', text, ({ suggestions }) => {
        if (suggestions?.length === 1) setCommand(command.startsWith('submit ') ? `submit ${suggestions[0]}` : suggestions[0]);
        else if (suggestions?.length) appendTerminal(`Suggestions: ${suggestions.join(', ')}`);
      });
    }
  }

  if (!view) return <div style={{ padding: 24 }}>Connecting to room...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 360px', minHeight: '100%' }}>
      <aside style={sidebarStyle}>
        {panel('Session', <>
          <div style={{ color: '#68ff9d', fontWeight: 700 }}>{view.roomId}</div>
          <div>Round: {view.round}</div>
          <div>Phase: {view.phase}</div>
          <div>You: {view.player.name}</div>
          <div>Role: {view.player.role}</div>
          <div>Team: {view.player.team}</div>
        </>)}
        {panel('Role Stats', <pre style={preStyle}>{JSON.stringify(view.player.stats, null, 2)}</pre>)}
        {panel('Presence', <div>{presence.map((p) => <div key={p.id}>{p.name} · {p.team} · {p.roleKey}</div>)}</div>)}
      </aside>

      <main style={{ padding: 16 }}>
        <div style={{ border: '1px solid #1d5034', background: '#000' }}>
          <div style={{ borderBottom: '1px solid #1d5034', padding: '12px 16px', color: '#68ff9d' }}>root@cybersec-ops:{view.player.team}~$</div>
          <div ref={terminalRef} style={{ height: 560, overflowY: 'auto', whiteSpace: 'pre-wrap', padding: 16, lineHeight: 1.6 }}>
            {terminal.map((line, i) => <div key={i}>{line}</div>)}
          </div>
          <div style={{ borderTop: '1px solid #1d5034', padding: 12, display: 'flex', gap: 12 }}>
            <span style={{ color: '#68ff9d' }}>&gt;</span>
            <input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={onKeyDown} style={{ ...inputStyle, background: 'transparent', border: 'none', color: '#d7fbe3' }} placeholder="submit investigate-alert" />
          </div>
        </div>
      </main>

      <aside style={sidebarStyle}>
        {panel('Hidden Intel View', <pre style={preStyle}>{JSON.stringify(view.visibleIntel, null, 2)}</pre>)}
        {panel('Available Commands', <div>{Object.keys(view.commandSet).map((c) => <div key={c}>{c}</div>)}</div>)}
        {panel('Narrations', <div>{narrations.map((n, i) => <pre key={i} style={preStyle}>{n.narration}</pre>)}</div>)}
      </aside>
    </div>
  );
}

const sidebarStyle = { borderRight: '1px solid #1d5034', background: 'linear-gradient(#06100b, #091711)', padding: 16 };
const inputStyle = { width: '100%', background: '#000', color: '#d7fbe3', border: '1px solid #1d5034', padding: '10px 12px' };
const buttonStyle = { background: '#10231a', color: '#68ff9d', border: '1px solid #1d5034', padding: '12px 16px', cursor: 'pointer' };
const preStyle = { margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 };

createRoot(document.getElementById('root')).render(<App />);
