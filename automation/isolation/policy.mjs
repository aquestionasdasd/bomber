// Trusted control code. Discord requests and model output cannot edit this file.
export const repository='aquestionasdasd/bomber';
export const image='node@sha256:a43f7fc3e52e87d12a905f46eea0275def84ca8f2981a5b53fed44d7fb398ee0';
export const files=Object.freeze({
  'public/death-view.js':['tests-death-view.cjs'],
  'public/range.js':['tests-range.cjs','tests-range-game.cjs'],
  'public/round-preparation.js':['tests-round-start-separation.cjs','tests-round-preparation-game.cjs'],
});
export const coreTests=Object.freeze(['tests-range.cjs','tests-renko-jet-duration.cjs','tests-renko-jet-kills.cjs','tests-skill-messages.cjs','tests-bot-perception.cjs']);
// Full-map separation covers 60 round states and 270 independent snapshots;
// the unchanged fixture was measured at 251 seconds on the owner baseline.
export const testTimeouts=Object.freeze({'tests-range-game.cjs':180,'tests-round-start-separation.cjs':600,'tests-round-preparation-game.cjs':90,'tests-skill-messages.cjs':90});
export const limits=Object.freeze({files:2,proposalBytes:32768,moduleBytes:16384,nodeCount:1600,testSeconds:45,jobSeconds:1140});
