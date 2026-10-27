export default function Marca({ claro = false, subtitulo }) {
  return (
    <div className={`marca ${claro ? 'marca-clara' : ''}`}>
      <span className="marca-logo">SENAI</span>
      {subtitulo && <span className="marca-sub">{subtitulo}</span>}
    </div>
  );
}
