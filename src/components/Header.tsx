import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const navLinks = [
    { name: 'Recursos', path: '/#recursos' },
    { name: 'Benefícios', path: '/#beneficios' },
    { name: 'Depoimentos', path: '/#depoimentos' },
    { name: 'Preços', path: '/plans' },
    { name: 'FAQ', path: '/#faq' },
  ];

  return (
    <header
      className={`fixed w-full z-50 transition-all duration-300 ${
        isScrolled ? 'bg-gray-900 shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center" onClick={closeMenu}>
          <Logo />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.path}
              className={`text-sm font-medium hover:text-lime-400 transition-colors ${
                location.pathname === link.path || 
                (location.hash === link.path.substring(link.path.indexOf('#')) && link.path.includes('#'))
                  ? 'text-lime-400'
                  : 'text-gray-200'
              }`}
            >
              {link.name}
            </Link>
          ))}
          <a
            href="https://app.drcfinancas.com.br"
            className="bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold py-2 px-6 rounded-md transition-colors"
          >
            Entrar
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white"
          onClick={toggleMenu}
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-800 absolute top-full left-0 w-full">
          <div className="container mx-auto px-4 py-3 flex flex-col space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`text-base font-medium py-2 hover:text-lime-400 transition-colors ${
                  location.pathname === link.path ? 'text-lime-400' : 'text-gray-200'
                }`}
                onClick={closeMenu}
              >
                {link.name}
              </Link>
            ))}
            <a
              href="https://app.drcfinancas.com.br"
              className="bg-lime-500 hover:bg-lime-400 text-gray-900 font-bold py-3 px-6 rounded-md transition-colors text-center"
            >
              Entrar
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;