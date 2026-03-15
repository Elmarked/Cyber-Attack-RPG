import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';

const API = 'http://localhost:3001';

const panel = (title, children) => (
  <section style={{ border: '1px solid #1d5034', background: '#0d1913', padding: 16, marginBottom: 16 }}>
    <div style={{ fontSize: 12, color: '#ffd66d', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>{title}</div>
    {children}
  </section>
);

const inputStyle = { width: '100%', background: '#000', color: '#d7fbe3', border: '1px solid #1d5034', padding: '10px 12px' };
const buttonStyle = { background: '#10231a', color: '#68ff9d', border: '1px solid #1d5034', padding: '12px 16px', cursor: 'pointer' };
const muted = { color: '#86bb95', lineHeight: 1.6 };
const preStyle = { margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'inherit' };
const cardStyle = { border: '1px solid #1d5034', padding: 12, marginBottom: 12, background: '#112218' };

function startCase(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeTerminalText(text) {
  return String(text ?? '')
    .replace(/```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[{}\[\]"]+/g, (m) => (m === '"' ? '' : m))
    .trimEnd();
}

function tryParseJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!looksLikeJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function deepNormalize(value) {
  const parsed = tryParseJson(value);
  if (Array.isArray(parsed)) return parsed.map((item) => deepNormalize(item));
  if (parsed && typeof parsed === 'object') {
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, deepNormalize(v)]));
  }
  return parsed;
}

function ensureObject(value) {
  const parsed = deepNormalize(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function ensureArray(value) {
  const parsed = deepNormalize(value);
  return Array.isArray(parsed) ? parsed : [];
}

function ensureStats(value) {
  const parsed = ensureObject(value);
  return Object.fromEntries(
    Object.entries(parsed).map(([key, stat]) => [key, Number(deepNormalize(stat)) || 0])
  );
}

function formatInlineValue(value) {
  const parsed = deepNormalize(value);
  if (parsed == null) return '';
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
  if (Array.isArray(parsed)) return parsed.map((item) => formatInlineValue(item)).filter(Boolean).join(', ');
  if (typeof parsed === 'object') return Object.entries(parsed).map(([k, v]) => `${startCase(k)}: ${formatInlineValue(v)}`).join(' | ');
  return String(parsed);
}

function StatBlock({ stats }) {
  const entries = Object.entries(ensureStats(stats));
  if (!entries.length) return <div style={muted}>No skill stats assigned yet.</div>;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {entries.map(([skill, value]) => (
        <div key={skill} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #1d5034', background: '#0f2318', padding: '10px 12px' }}>
          <span>{startCase(skill)}</span>
          <span style={{ color: '#68ff9d', fontWeight: 700 }}>+{value}</span>
        </div>
      ))}
    </div>
  );
}

function ChipList({ items }) {
  const safeItems = ensureArray(items).map((item) => formatInlineValue(item)).filter(Boolean);
  if (!safeItems.length) return <div style={muted}>None listed.</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {safeItems.map((item) => (
        <span key={item} style={{ border: '1px solid #1d5034', background: '#0f2318', padding: '6px 10px', fontSize: 12, color: '#68ff9d' }}>{item}</span>
      ))}
    </div>
  );
}

function BulletList({ items }) {
  const safeItems = ensureArray(items).map((item) => formatInlineValue(item)).filter(Boolean);
  if (!safeItems.length) return <div style={muted}>No items available.</div>;
  return (
    <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
      {safeItems.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

function HiddenIntelPanel({ intel, team }) {
  const safeIntel = ensureObject(intel);
  if (!Object.keys(safeIntel).length) return <div style={muted}>No intel available yet.</div>;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <div style={{ fontSize: 12, color: '#68ff9d', marginBottom: 4 }}>{String(team || '').toUpperCase()} PERSPECTIVE</div>
        <div style={muted}>This view is filtered for team-specific knowledge and hidden state.</div>
      </div>

      {safeIntel.title && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Scenario</div>
          <div>{formatInlineValue(safeIntel.title)}</div>
        </div>
      )}

      {safeIntel.business && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Business Context</div>
          <div style={muted}>{formatInlineValue(safeIntel.business)}</div>
        </div>
      )}

      {safeIntel.dayToDay && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Day-to-Day Operations</div>
          <div style={muted}>{formatInlineValue(safeIntel.dayToDay)}</div>
        </div>
      )}

      {safeIntel.setting && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Current Time and Setting</div>
          <div>{formatInlineValue(safeIntel.setting)}</div>
        </div>
      )}

      {safeIntel.timePressure && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Operational Pressure</div>
          <div style={muted}>{formatInlineValue(safeIntel.timePressure)}</div>
        </div>
      )}

      {(safeIntel.assets || safeIntel.coreAssets) && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>Core Assets</div>
          <ChipList items={safeIntel.assets || safeIntel.coreAssets} />
        </div>
      )}

      {safeIntel.objectives && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>{team === 'red' ? 'Likely Objectives' : 'Protected Objectives'}</div>
          <BulletList items={safeIntel.objectives} />
        </div>
      )}

      {(safeIntel.hiddenHints || safeIntel.hints) && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>{team === 'red' ? 'Operational Clues' : 'Hidden Risk Hints'}</div>
          <BulletList items={safeIntel.hiddenHints || safeIntel.hints} />
        </div>
      )}

      {safeIntel.currentAssessment && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>Current Assessment</div>
          <BulletList items={safeIntel.currentAssessment} />
        </div>
      )}

      {safeIntel.attackSurfacePressure && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Attack Surface Pressure</div>
          <div style={muted}>{formatInlineValue(safeIntel.attackSurfacePressure)}</div>
        </div>
      )}

      {(safeIntel.awareness !== undefined || safeIntel.exploitPenalty !== undefined || safeIntel.foothold !== undefined || safeIntel.objectivesConfidence !== undefined) && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>Operational State</div>
          <BulletList items={[
            safeIntel.awareness !== undefined ? `Awareness: ${formatInlineValue(safeIntel.awareness)}` : null,
            safeIntel.exploitPenalty !== undefined ? `Exploit Penalty: ${formatInlineValue(safeIntel.exploitPenalty)}` : null,
            safeIntel.foothold !== undefined ? `Foothold: ${formatInlineValue(safeIntel.foothold)}` : null,
            safeIntel.objectivesConfidence !== undefined ? `Objective Confidence: ${formatInlineValue(safeIntel.objectivesConfidence)}%` : null,
          ].filter(Boolean)} />
        </div>
      )}

      {safeIntel.actor && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>Threat Actor</div>
          <div style={{ color: '#68ff9d', fontWeight: 700 }}>{formatInlineValue(safeIntel.actor.name)}</div>
          <div>{formatInlineValue(safeIntel.actor.type)}</div>
          <div style={{ ...muted, marginTop: 6 }}>Motives: {formatInlineValue(safeIntel.actor.motives)}</div>
          <div style={muted}>Methodology: {formatInlineValue(safeIntel.actor.methodologies)}</div>
        </div>
      )}

      {safeIntel.actorMotives && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Adversary Motive Estimate</div>
          <div style={muted}>{formatInlineValue(safeIntel.actorMotives)}</div>
        </div>
      )}

      {safeIntel.discovered && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>Discovered Intel</div>
          <BulletList items={safeIntel.discovered} />
        </div>
      )}

      {safeIntel.chain && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 6 }}>Likely ATT&CK Path</div>
          <BulletList items={safeIntel.chain} />
        </div>
      )}

      {safeIntel.strategicGuess && (
        <div>
          <div style={{ color: '#ffd66d', marginBottom: 4 }}>Strategic Guess</div>
          <div>{formatInlineValue(safeIntel.strategicGuess)}</div>
        </div>
      )}
    </div>
  );
}

function CharacterSummary({ character, roleLabel }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: '#68ff9d', fontWeight: 700, fontSize: 18 }}>{character.name}</div>
      <div style={{ marginBottom: 8 }}>{character.team.toUpperCase()} · {roleLabel}</div>
      <div style={{ ...muted, marginBottom: 12 }}>{character.bio || 'No bio yet.'}</div>
      <StatBlock stats={character.stats} />
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(() => {
    const stored = localStorage.getItem('cybersec_token');
    return stored ? { token: stored } : null;
  });
  const [roles, setRoles] = useState({ blue: [], red: [] });

  useEffect(() => {
    fetch(`${API}/meta/roles`).then((r) => r.json()).then(setRoles);
  }, []);

  if (!auth?.token) return <AuthScreen roles={roles} onAuthed={setAuth} />;
  if (!auth?.user) return <CharacterHub roles={roles} auth={auth} onJoined={setAuth} onLogout={() => { localStorage.removeItem('cybersec_token'); setAuth(null); }} />;
  return <GameScreen auth={auth} onLeave={() => setAuth({ token: null })} />;
}

function AuthScreen({ roles, onAuthed }) {
  const [mode, setMode] = useState('register');
  const [form, setForm] = useState({ displayName: '', username: '', password: '' });
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    const url = mode === 'login' ? '/auth/register' : '/auth/register';
    const res = await fetch(`${API}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Authentication failed');
    onAuthed(data);
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
      <form onSubmit={submit} style={{ width: 420, border: '1px solid #1d5034', background: '#0d1913', padding: 24 }}>
        <div style={{ color: '#68ff9d', fontSize: 28, marginBottom: 8 }}>CYBERSEC OPS</div>
        <div style={{ ...muted, marginBottom: 20 }}>Create an account, build characters, and rejoin active rooms with reconnect-safe session recovery.</div>
        {mode === 'register' && <div style={{ marginBottom: 12 }}><input placeholder="Display name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} style={inputStyle} /></div>}
        <div style={{ marginBottom: 12 }}><input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inputStyle} /></div>
        <div style={{ marginBottom: 12 }}><input type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} /></div>
        {error && <div style={{ color: '#ff8e8e', marginBottom: 12 }}>{error}</div>}
        <button style={buttonStyle}>{mode === 'login' ? 'Log In' : 'Register'}</button>
        <div style={{ marginTop: 12 }}><button type="button" style={{ ...buttonStyle, background: '#091711', width: '100%' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account?' : 'Already have an account?'}</button></div>
      </form>
    </div>
  );
}

function CharacterHub({ roles, auth, onJoined, onLogout }) {
  const [characters, setCharacters] = useState(auth.user.characters || []);
  const [building, setBuilding] = useState(false);
  const [roomId, setRoomId] = useState('alpha');

  async function refresh() {
    const data = await fetch(`${API}/users/${auth.user.id}/characters`).then((r) => r.json());
    setCharacters(data.characters || []);
  }

  async function joinCharacter(characterId) {
    const res = await fetch(`${API}/rooms/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: auth.user.id, characterId, roomId }) });
    const data = await res.json();
    if (data.ok) {
      localStorage.setItem('cybersec_token', data.token);
      onJoined({ user: { ...auth.user, characters }, token: data.token });
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        <div>
          {panel('Character Hub', <>
            <div style={{ color: '#68ff9d', fontSize: 24, marginBottom: 8 }}>Welcome, {auth.user.displayName}</div>
            <div style={muted}>Choose one of your saved characters or create a new one. Roles are locked at creation, and stat allocations directly modify in-game rolls for that role’s skill-linked commands.</div>
          </>)}

          {panel('Your Characters', <>
            {characters.length === 0 && <div style={muted}>No characters yet. Create one to continue.</div>}
            {characters.map((c) => (
              <div key={c.id}>
                <CharacterSummary character={c} roleLabel={roles[c.team]?.find((r) => r.key === c.roleKey)?.role} />
                <button style={{ ...buttonStyle, marginBottom: 12 }} onClick={() => joinCharacter(c.id)}>Select Character and Join Room</button>
              </div>
            ))}
          </>)}
        </div>

        <div>
          {panel('Room Selection', <>
            <input style={inputStyle} value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room ID" />
            <div style={{ ...muted, marginTop: 10 }}>Use the same room ID across players to join the same match.</div>
          </>)}

          {panel('Actions', <>
            <button style={{ ...buttonStyle, width: '100%', marginBottom: 12 }} onClick={() => setBuilding((v) => !v)}>{building ? 'Close Character Builder' : 'Create New Character'}</button>
            <button style={{ ...buttonStyle, width: '100%', background: '#091711' }} onClick={onLogout}>Log Out</button>
          </>)}

          {building && <CharacterBuilder userId={auth.user.id} roles={roles} onCreated={async () => { await refresh(); setBuilding(false); }} />}
        </div>
      </div>
    </div>
  );
}

function CharacterBuilder({ userId, roles, onCreated }) {
  const [team, setTeam] = useState('blue');
  const [roleKey, setRoleKey] = useState('soc');
  const [name, setName] = useState('');
  const [stats, setStats] = useState({ analysis: 4, identity: 3, telemetry: 3 });
  const [bio, setBio] = useState('');
  const [generateBio, setGenerateBio] = useState(true);
  const [error, setError] = useState('');

  const role = roles[team]?.find((r) => r.key === roleKey) || { skills: [], statPoints: 10, role: '' };

  useEffect(() => {
    const base = {};
    role.skills.forEach((s) => {
      base[s] = 0;
    });
    setStats(base);
  }, [team, roleKey]);

  const spent = useMemo(() => Object.values(stats).reduce((a, b) => a + Number(b || 0), 0), [stats]);
  const remaining = role.statPoints - spent;

  async function randomize() {
    const res = await fetch(`${API}/users/${userId}/characters/randomize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team, roleKey }) });
    const data = await res.json();
    if (data.stats) setStats(data.stats);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API}/users/${userId}/characters`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, team, roleKey, stats, bio, generateBio }) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Failed to save character');
    onCreated();
  }

  return (
    <form onSubmit={save}>
      {panel('Character Creation Journey', <>
        <div style={muted}>1. Pick a side. 2. Pick a role-class. 3. Spend stat points on role-specific skills or randomize them. 4. Write a bio or generate one. 5. Save the character to your account.</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          <input style={inputStyle} placeholder="Character name" value={name} onChange={(e) => setName(e.target.value)} />
          <select style={inputStyle} value={team} onChange={(e) => { setTeam(e.target.value); setRoleKey(e.target.value === 'blue' ? 'soc' : 'recon'); }}>
            <option value="blue">Blue Team</option>
            <option value="red">Red Team</option>
          </select>
          <select style={inputStyle} value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {(roles[team] || []).map((r) => <option key={r.key} value={r.key}>{r.role}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 12, color: '#68ff9d' }}>{role.role}</div>
        <div style={muted}>{role.description}</div>
        <div style={{ marginTop: 12 }}>Stat points remaining: <strong style={{ color: remaining < 0 ? '#ff8e8e' : '#68ff9d' }}>{remaining}</strong></div>
        {role.skills.map((skill) => (
          <div key={skill} style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <div>{startCase(skill)}</div>
            <input type="number" min="0" max={role.statPoints} value={stats[skill] ?? 0} onChange={(e) => setStats({ ...stats, [skill]: Number(e.target.value) })} style={inputStyle} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <button type="button" style={buttonStyle} onClick={randomize}>Randomize Stats</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...muted }}><input type="checkbox" checked={generateBio} onChange={(e) => setGenerateBio(e.target.checked)} />Generate bio</label>
        </div>
        {!generateBio && <textarea style={{ ...inputStyle, minHeight: 120, marginTop: 12 }} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write the character bio" />}
        <div style={{ ...muted, marginTop: 12 }}>Higher stat values lower the die result needed for success because they are added as roll modifiers to commands that use that skill. Role cannot be changed after creation.</div>
        {error && <div style={{ color: '#ff8e8e', marginTop: 12 }}>{error}</div>}
        <button disabled={!name || remaining < 0} style={{ ...buttonStyle, width: '100%', marginTop: 12 }}>Save Character</button>
      </>)}
    </form>
  );
}

function formatStatusLines(view) {
  return [
    `Room: ${view?.roomId || '-'}`,
    `Round: ${view?.round ?? '-'}`,
    `Phase: ${String(view?.phase || '-').toUpperCase()}`,
    `Player: ${view?.player?.name || '-'}`,
    `Role: ${view?.player?.role || '-'}`,
    `Team: ${String(view?.player?.team || '-').toUpperCase()}`,
  ].join('\n');
}

function formatSkillsLines(stats) {
  const entries = Object.entries(ensureStats(stats));
  if (!entries.length) return 'No stats available.';
  return entries.map(([skill, value]) => `${startCase(skill)}: +${value}`).join('\n');
}

function formatIntelLines(intel, team) {
  const safeIntel = ensureObject(intel);
  const lines = [];
  if (safeIntel.title) lines.push(`Scenario: ${formatInlineValue(safeIntel.title)}`);
  if (safeIntel.setting) lines.push(`Setting: ${formatInlineValue(safeIntel.setting)}`);
  if (safeIntel.business) lines.push(`Business: ${formatInlineValue(safeIntel.business)}`);
  if (safeIntel.dayToDay) lines.push(`Day-to-Day: ${formatInlineValue(safeIntel.dayToDay)}`);
  if (safeIntel.objectives) {
    lines.push(team === 'red' ? 'Likely Objectives:' : 'Protected Objectives:');
    ensureArray(safeIntel.objectives).forEach((item) => lines.push(`- ${formatInlineValue(item)}`));
  }
  const hints = safeIntel.hiddenHints || safeIntel.hints;
  if (hints) {
    lines.push(team === 'red' ? 'Operational Clues:' : 'Hidden Risk Hints:');
    ensureArray(hints).forEach((item) => lines.push(`- ${formatInlineValue(item)}`));
  }
  if (safeIntel.attackSurfacePressure) lines.push(`Pressure: ${formatInlineValue(safeIntel.attackSurfacePressure)}`);
  if (safeIntel.awareness !== undefined) lines.push(`Awareness: ${formatInlineValue(safeIntel.awareness)}`);
  if (safeIntel.exploitPenalty !== undefined) lines.push(`Exploit Penalty: ${formatInlineValue(safeIntel.exploitPenalty)}`);
  if (safeIntel.discovered) {
    lines.push('Discovered Intel:');
    ensureArray(safeIntel.discovered).forEach((item) => lines.push(`- ${formatInlineValue(item)}`));
  }
  if (safeIntel.objectivesConfidence !== undefined) lines.push(`Objective Confidence: ${formatInlineValue(safeIntel.objectivesConfidence)}%`);
  if (safeIntel.foothold !== undefined) lines.push(`Foothold: ${formatInlineValue(safeIntel.foothold)}`);
  return lines.join('\n') || 'No intel available.';
}

function formatSubmitResponse(res) {
  const safe = ensureObject(res);
  if (safe.error) return `Error: ${formatInlineValue(safe.error)}`;
  if (!safe.action) return 'Action submitted.';
  const action = ensureObject(safe.action);
  const result = ensureObject(action.result);
  return [
    `${formatInlineValue(action.actor)} submitted ${formatInlineValue(action.command)}`,
    `Outcome: ${formatInlineValue(result.outcome)}`,
    `Roll: ${formatInlineValue(result.die)} + ${formatInlineValue(result.modifier)} = ${formatInlineValue(result.total)} vs ${formatInlineValue(result.difficulty)}`,
  ].join('\n');
}

function GameScreen({ auth, onLeave }) {
  const [view, setView] = useState(null);
  const [presence, setPresence] = useState([]);
  const [narrations, setNarrations] = useState([]);
  const [terminal, setTerminal] = useState(['CYBERSEC OPS TERMINAL READY', 'Type help for commands. ArrowUp and ArrowDown browse history. Tab autocompletes.']);
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const socketRef = useRef(null);
  const terminalRef = useRef(null);

  useEffect(() => {
    const socket = io(API, { auth: { token: auth.token } });
    socketRef.current = socket;

    socket.on('room:view', (payload) => {
      const normalized = deepNormalize(payload);
      const nextView = ensureObject(normalized);
      nextView.player = ensureObject(nextView.player);
      nextView.player.stats = ensureStats(nextView.player.stats);
      nextView.commandSet = ensureObject(nextView.commandSet);
      nextView.visibleIntel = ensureObject(nextView.visibleIntel);
      nextView.history = ensureArray(nextView.history);
      setView(nextView);
    });
    socket.on('room:presence', (msg) => setPresence(ensureArray(msg.players)));
    socket.on('room:narration', (msg) => {
      const normalized = deepNormalize(msg);
      setNarrations((n) => [normalized, ...n].slice(0, 5));
      appendTerminal(normalized.narration);
    });
    socket.on('room:event', (msg) => appendTerminal(`EVENT: ${msg.actor} submitted ${msg.command} -> ${msg.outcome}`));

    return () => socket.disconnect();
  }, [auth.token]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminal]);

  function appendTerminal(text) {
    const clean = normalizeTerminalText(text);
    if (!clean) return;
    setTerminal((t) => [...t, clean]);
  }

  function runCommand(raw) {
    const input = raw.trim();
    if (!input) return;

    appendTerminal(`> ${input}`);
    setHistory((h) => [...h, input]);
    setHistoryIndex(-1);

    const [cmd, ...rest] = input.split(' ');

    if (cmd === 'help') return appendTerminal([
      'help',
      'status',
      'intel',
      'roles',
      'skills',
      'history',
      'submit <command>',
      'autocomplete <prefix>',
      'leave'
    ].join('\n'));

    if (cmd === 'status') return appendTerminal(formatStatusLines(view));
    if (cmd === 'intel') return appendTerminal(formatIntelLines(view?.visibleIntel, view?.player?.team));
    if (cmd === 'roles') return appendTerminal(Object.keys(view?.commandSet || {}).join('\n') || 'No commands available.');
    if (cmd === 'skills') return appendTerminal(formatSkillsLines(view?.player?.stats));

    if (cmd === 'history') {
      const text = (view?.history || []).map((entry) => `Round ${entry.round} ${String(entry.phase).toUpperCase()}\n${normalizeTerminalText(entry.narration)}`).join('\n\n---\n\n') || 'No history yet';
      return appendTerminal(text);
    }

    if (cmd === 'autocomplete') {
      return socketRef.current.emit('command:autocomplete', rest.join(' '), (data) => appendTerminal((data?.suggestions || []).join('\n') || 'No suggestions'));
    }

    if (cmd === 'submit') {
      return socketRef.current.emit('command:submit', { command: rest.join(' ') }, (res) => {
        appendTerminal(formatSubmitResponse(res));
      });
    }

    if (cmd === 'leave') {
      localStorage.removeItem('cybersec_token');
      onLeave();
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
        if (suggestions?.length === 1) {
          setCommand(command.startsWith('submit ') ? `submit ${suggestions[0]}` : suggestions[0]);
        } else if (suggestions?.length) {
          appendTerminal(`Suggestions: ${suggestions.join(', ')}`);
        }
      });
    }
  }

  if (!view) return <div style={{ padding: 24 }}>Connecting to room...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 360px', minHeight: '100%' }}>
      <aside style={{ borderRight: '1px solid #1d5034', background: 'linear-gradient(#06100b, #091711)', padding: 16 }}>
        {panel('Session', <>
          <div style={{ color: '#68ff9d', fontWeight: 700 }}>{view.roomId}</div>
          <div>Round: {view.round}</div>
          <div>Phase: {String(view.phase).toUpperCase()}</div>
          <div>You: {view.player.name}</div>
          <div>Role: {view.player.role}</div>
          <div>Team: {view.player.team}</div>
        </>)}

        {panel('Role Stats', <StatBlock stats={view.player.stats} />)}
        {panel('Character Bio', <div style={muted}>{view.player.bio || 'No bio available for this character.'}</div>)}

        {panel('Presence', <div style={{ display: 'grid', gap: 8 }}>
          {presence.map((p) => (
            <div key={p.id} style={{ border: '1px solid #1d5034', background: '#112218', padding: '8px 10px' }}>
              <div style={{ color: '#68ff9d' }}>{p.name}</div>
              <div style={muted}>{String(p.team).toUpperCase()} · {startCase(p.roleKey)} · {p.connected === false ? 'offline' : 'online'}</div>
            </div>
          ))}
        </div>)}
      </aside>

      <main style={{ padding: 16 }}>
        <div style={{ border: '1px solid #1d5034', background: '#000' }}>
          <div style={{ borderBottom: '1px solid #1d5034', padding: '12px 16px', color: '#68ff9d' }}>root@cybersec-ops:{view.player.team}~$</div>
          <div ref={terminalRef} style={{ height: 560, overflowY: 'auto', padding: 16, lineHeight: 1.6 }}>
            {terminal.map((line, i) => <pre key={i} style={preStyle}>{line}</pre>)}
          </div>
          <div style={{ borderTop: '1px solid #1d5034', padding: 12, display: 'flex', gap: 12 }}>
            <span style={{ color: '#68ff9d' }}>&gt;</span>
            <input value={command} onChange={(e) => setCommand(e.target.value)} onKeyDown={onKeyDown} style={{ ...inputStyle, background: 'transparent', border: 'none', color: '#d7fbe3' }} placeholder="submit investigate-alert" />
          </div>
        </div>
      </main>

      <aside style={{ borderLeft: '1px solid #1d5034', background: 'linear-gradient(#06100b, #091711)', padding: 16 }}>
        {panel('Hidden Intel View', <HiddenIntelPanel intel={view.visibleIntel} team={view.player.team} />)}
        {panel('Available Commands', <ChipList items={Object.keys(view.commandSet || {})} />)}
        {panel('Narrations', <div style={{ display: 'grid', gap: 10 }}>
          {narrations.length === 0 && <div style={muted}>No completed narrated phase yet.</div>}
          {narrations.map((n, i) => <div key={i} style={{ border: '1px solid #1d5034', background: '#112218', padding: 12 }}><pre style={preStyle}>{normalizeTerminalText(n.narration)}</pre></div>)}
        </div>)}
      </aside>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
