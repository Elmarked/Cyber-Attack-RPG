import { MITRE, ROLE_DEFS, SCENARIOS } from './gameData.js';

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

export function buildScenario() {
  const s = structuredClone(pick(SCENARIOS));
  return {
    ...s,
    attackChainCards: s.attackChain.map((id) => MITRE.find((m) => m.id === id)).filter(Boolean),
    hiddenState: {
      attackerFoothold: 0,
      defenderAwareness: 1,
      objectiveIntelLevel: 0,
      objectiveExposure: 0,
      exploitPenalty: 0,
      detectionBoost: 0,
    }
  };
}

export function createRoom(roomId) {
  return {
    id: roomId,
    round: 1,
    phase: 'blue',
    scenario: buildScenario(),
    players: {},
    submitted: { blue: [], red: [] },
    history: [],
  };
}

export function getRoleDef(team, roleKey) {
  return ROLE_DEFS[team].find((r) => r.key === roleKey);
}

export function allocateStats(team, roleKey, values) {
  const role = getRoleDef(team, roleKey);
  if (!role) throw new Error('Unknown role');
  const sum = Object.values(values).reduce((a, b) => a + b, 0);
  if (sum > role.statPoints) throw new Error('Too many stat points assigned');
  for (const skill of Object.keys(values)) {
    if (!role.skills.includes(skill)) throw new Error(`Invalid skill for role: ${skill}`);
    if (values[skill] < 0) throw new Error('Negative stat allocation not allowed');
  }
  return values;
}

export function skillModifier(player, commandSpec) {
  const skillValue = player.stats[commandSpec.skill] || 0;
  return skillValue;
}

export function resolveAction(room, player, command) {
  const role = getRoleDef(player.team, player.roleKey);
  const commandSpec = role?.commands[command];
  if (!commandSpec) throw new Error('Command not available to this role');

  let difficulty = commandSpec.baseDifficulty;
  const hs = room.scenario.hiddenState;

  if (player.team === 'red') {
    if (['exploit-public-app', 'chain-auth-bypass', 'pivot-laterally', 'stage-exfiltration', 'prepare-impact'].includes(command)) {
      difficulty += hs.exploitPenalty;
    }
    if (['scan-surface', 'harvest-identities', 'enumerate-edge'].includes(command)) {
      difficulty += Math.max(0, hs.defenderAwareness - 1);
    }
  } else {
    if (['investigate-alert', 'search-logs', 'hunt-identity', 'analyze-iocs'].includes(command)) {
      difficulty -= hs.detectionBoost;
    }
  }

  const die = d20();
  const modifier = skillModifier(player, commandSpec);
  const total = die + modifier;
  let outcome = 'Failure';
  if (die === 20) outcome = 'Critical Success';
  else if (total >= difficulty) outcome = 'Success';
  else if (total >= difficulty - 2) outcome = 'Partial Success';

  applyConsequences(room, player.team, command, outcome);

  return {
    playerId: player.id,
    playerName: player.name,
    actor: role.role,
    command,
    result: { die, modifier, difficulty, total, outcome }
  };
}

export function applyConsequences(room, team, command, outcome) {
  const hs = room.scenario.hiddenState;
  const good = outcome === 'Success' || outcome === 'Critical Success';
  const partial = outcome === 'Partial Success';

  if (team === 'blue') {
    if (good && command === 'deploy-patch') hs.exploitPenalty += 2;
    if (partial && command === 'deploy-patch') hs.exploitPenalty += 1;
    if (good && command === 'restrict-admin-path') hs.exploitPenalty += 1;
    if (good && ['investigate-alert', 'search-logs', 'hunt-identity', 'analyze-iocs'].includes(command)) hs.defenderAwareness += 1;
    if (good && ['tune-detections', 'map-techniques', 'predict-next-step'].includes(command)) hs.detectionBoost += 1;
  } else {
    if (good && ['scan-surface', 'harvest-identities', 'enumerate-edge', 'discover-sensitive-data'].includes(command)) hs.objectiveIntelLevel += 1;
    if (good && ['exploit-public-app', 'chain-auth-bypass', 'dump-credentials', 'pivot-laterally'].includes(command)) hs.attackerFoothold += 1;
    if (good && ['stage-exfiltration', 'prepare-impact'].includes(command)) hs.objectiveExposure += 1;
    if (good && ['harvest-identities', 'craft-phish', 'dump-credentials'].includes(command)) hs.detectionBoost = Math.max(0, hs.detectionBoost - 1);
  }
}

export function allPlayersSubmitted(room) {
  const activeTeam = room.phase;
  const teamPlayers = Object.values(room.players).filter((p) => p.team === activeTeam);
  return teamPlayers.length > 0 && room.submitted[activeTeam].length >= teamPlayers.length;
}

export function advancePhase(room, narration) {
  room.history.push({ round: room.round, phase: room.phase, narration, actions: structuredClone(room.submitted[room.phase]) });
  room.submitted[room.phase] = [];
  if (room.phase === 'blue') room.phase = 'red';
  else {
    room.phase = 'blue';
    room.round += 1;
  }
}

export function teamView(room, player) {
  const s = room.scenario;
  const common = {
    roomId: room.id,
    round: room.round,
    phase: room.phase,
    player: {
      id: player.id,
      name: player.name,
      team: player.team,
      roleKey: player.roleKey,
      stats: player.stats,
      role: getRoleDef(player.team, player.roleKey)?.role,
    },
    commandSet: getRoleDef(player.team, player.roleKey)?.commands || {},
    history: room.history.slice(-4),
  };

  if (player.team === 'blue') {
    return {
      ...common,
      visibleIntel: {
        title: s.title,
        setting: s.setting,
        business: s.business,
        dayToDay: s.dayToDay,
        objectives: s.objectives,
        hints: s.blueHints,
        attackSurfacePressure: s.timePressure,
        awareness: s.hiddenState.defenderAwareness,
        exploitPenalty: s.hiddenState.exploitPenalty,
      }
    };
  }

  const discovered = [...s.redIntel];
  if (s.hiddenState.objectiveIntelLevel >= 1) discovered.push('The target likely has reachable staff and vendor access pathways.');
  if (s.hiddenState.objectiveIntelLevel >= 2) discovered.push('At least one remote-access or identity path appears weaker than the stated security posture.');
  if (s.hiddenState.objectiveIntelLevel >= 3) discovered.push(`Likely crown-jewel target: ${s.objectives[0]}.`);

  return {
    ...common,
    visibleIntel: {
      title: s.title,
      setting: s.setting,
      actorMotives: 'Monetary, ideological, or intelligence collection pressure depending on the generated actor profile.',
      objectivesConfidence: Math.min(100, 20 + s.hiddenState.objectiveIntelLevel * 20),
      discovered,
      foothold: s.hiddenState.attackerFoothold,
      exploitPenalty: s.hiddenState.exploitPenalty,
    }
  };
}
