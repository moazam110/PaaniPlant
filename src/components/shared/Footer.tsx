export default function Footer() {
  return (
    <footer className="text-center py-4 px-4 text-sm text-black bg-background/50 backdrop-blur-sm border-t border-border/50 mt-auto">
      <div>Copyright &copy; 2025 The Paani</div>
      <div className="mt-1 text-xs text-muted-foreground">
        Developed by{' '}
        <a
          href="mailto:moazamabbasi2k1@gmail.com"
          className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
        >
          Moazam <span className="text-[10px]">↗</span>
        </a>
      </div>
    </footer>
  );
}
