import { GameProvider, useGame } from './context/GameContext';
import { CharacterCreation } from './components/CharacterCreation';
import { MainDashboard } from './components/MainDashboard';

function GameContent() {
  const { player } = useGame();

  if (!player) {
    return <CharacterCreation />;
  }

  return <MainDashboard />;
}

export default function App() {
  return (
    <GameProvider>
      <div className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
        <GameContent />
      </div>
    </GameProvider>
  );
}
