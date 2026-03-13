import OpenAI from 'openai';

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const model = process.env.OPENAI_MODEL || 'gpt-5.4';

function localBlue(actions, room) {
  const successes = actions.filter((a) => ['Success', 'Critical Success'].includes(a.result.outcome)).length;
  return [
    `Incident Update :: ${room.scenario.title}`,
    `Time Context: ${room.scenario.setting}. ${room.scenario.timePressure}`,
    `Summary: Blue team completed ${actions.length} action(s); ${successes} delivered clear operational progress.`,
    ...actions.map((a) => `- ${a.playerName} (${a.actor}) ran '${a.command}' -> ${a.result.outcome} [d20 ${a.result.die} + ${a.result.modifier} = ${a.result.total} vs ${a.result.difficulty}]`),
    'Assessment: Defensive actions improved visibility and may increase attacker friction, but residual risk remains.'
  ].join('\n');
}

function localRed(actions, room) {
  return [
    `[Encrypted Chat :: ${room.scenario.title}]`,
    'shade: target still feels live. keep moving but keep the noise down.',
    ...actions.map((a) => `${a.playerName.toLowerCase()}: ${a.command} -> ${a.result.outcome.toLowerCase()} (d20 ${a.result.die} + ${a.result.modifier} = ${a.result.total} vs ${a.result.difficulty})`),
    'wisp: if the edge stays soft we can keep leaning in.'
  ].join('\n');
}

export async function narratePhase(room, actions, phase) {
  if (!client) {
    return phase === 'blue' ? localBlue(actions, room) : localRed(actions, room);
  }

  const system = phase === 'blue'
    ? 'Write a formal, realistic SOC or incident-response update. Use corporate language, precise detail, and operational caution.'
    : 'Write a casual but technically credible encrypted attacker group chat. Keep it terse, realistic, and slightly informal.';

  const input = {
    scenario: {
      title: room.scenario.title,
      setting: room.scenario.setting,
      business: room.scenario.business,
      dayToDay: room.scenario.dayToDay,
      timePressure: room.scenario.timePressure,
      objectives: room.scenario.objectives,
      hiddenState: room.scenario.hiddenState,
    },
    phase,
    actions,
  };

  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: `Narrate this completed phase:\n${JSON.stringify(input, null, 2)}` }
      ]
    });

    return response.output_text || (phase === 'blue' ? localBlue(actions, room) : localRed(actions, room));
  } catch {
    return phase === 'blue' ? localBlue(actions, room) : localRed(actions, room);
  }
}
