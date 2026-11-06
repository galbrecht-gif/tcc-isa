export default function Marca({ claro = false, subtitulo }) {
  return (
    <div className={`marca ${claro ? 'marca-clara' : ''}`}>
      <img className="marca-logo" src="/senai-logo.png" alt="SENAI" />
      {subtitulo && <span className="marca-sub">{subtitulo}</span>}
    </div>
  );
}
