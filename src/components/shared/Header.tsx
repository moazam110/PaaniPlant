
import type React from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    // Ensure header uses theme colors appropriately for light mode
    <header className="py-6 px-4 md:px-8 bg-primary shadow-md"> 
      <h1 className="text-3xl font-normal text-primary-foreground text-center" style={{ fontFamily: 'Georgia, serif' }}>
        {title}
      </h1>
    </header>
  );
};

export default Header;
