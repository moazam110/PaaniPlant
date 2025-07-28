
import type React from 'react';

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  return (
    // Ensure header uses theme colors appropriately for light mode
    <header className="py-6 px-4 md:px-8 bg-primary shadow-md"> 
      <h1 className="text-3xl font-headline font-bold text-primary-foreground">
        {title}
      </h1>
    </header>
  );
};

export default Header;
