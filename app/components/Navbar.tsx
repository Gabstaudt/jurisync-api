import Link from "next/link";
import styles from "./Navbar.module.css";

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.brand}>
        <span className={styles.dot} />
        <Link href="/">JuriSync</Link>
      </div>
      <nav className={styles.links}>
        <Link href="/">Início</Link>
        <a href="#chat">Chat</a>
        <a href="#folders">Pastas</a>
      </nav>
      <div className={styles.actions}>
        <span className={styles.badge}>Beta</span>
      </div>
    </header>
  );
}
