import React, { useState } from 'react';
import { Icon, LOGO_DATA_URI } from '../constants';

export const Logo = () => (
    // Explicit style={{ width, height }} is the ultimate safety net against CSS loading failures
    <div className="relative w-10 h-10 transition-transform hover:scale-105 duration-500 logo-safe" style={{ width: '2.5rem', height: '2.5rem' }}>
        <div className="absolute inset-0 bg-blue-600 rounded-lg rotate-6 opacity-20 blur-md animate-pulse"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow-xl flex items-center justify-center text-white border border-white/10 overflow-hidden">
             <img src={LOGO_DATA_URI} alt="TrackSpendz Logo" className="w-full h-full object-cover" />
        </div>
    </div>
);

export const Navbar = ({ activeView, setView }: { activeView: string, setView: (v: string) => void }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleNav = (view: string) => {
        setView(view);
        setIsMenuOpen(false);
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 h-16">
            <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleNav('home')}>
                    <Logo />
                    <span className="font-bold text-xl text-slate-800 tracking-tight">Track<span className="text-blue-600">Spendz</span></span>
                </div>
                
                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-6">
                    <button onClick={() => setView('home')} className={`text-sm font-medium transition-colors ${activeView === 'home' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Home</button>
                    <button onClick={() => setView('features')} className={`text-sm font-medium transition-colors ${activeView === 'features' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Features</button>
                    <button onClick={() => setView('contact')} className={`text-sm font-medium transition-colors ${activeView === 'contact' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Help</button>
                </div>

                {/* Mobile Menu Toggle */}
                <button 
                    className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle Menu"
                >
                    {isMenuOpen ? <Icon name="close" className="w-6 h-6" /> : <Icon name="menu" className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-slate-100 shadow-xl absolute w-full left-0 animate-fade-in">
                    <div className="flex flex-col p-4 space-y-2">
                        <button onClick={() => handleNav('home')} className={`text-left px-4 py-3 rounded-xl font-medium ${activeView === 'home' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Home</button>
                        <button onClick={() => handleNav('features')} className={`text-left px-4 py-3 rounded-xl font-medium ${activeView === 'features' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Features</button>
                        <button onClick={() => handleNav('contact')} className={`text-left px-4 py-3 rounded-xl font-medium ${activeView === 'contact' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}>Help Center</button>
                    </div>
                </div>
            )}
        </nav>
    );
};

export const Footer = ({ setView }: { setView: (v: string) => void }) => (
    <footer className="bg-white border-t border-slate-200 py-12 mt-auto">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 overflow-hidden rounded" style={{ width: '1.5rem', height: '1.5rem' }}>
                        <img src={LOGO_DATA_URI} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold text-lg text-slate-800">Track<span className="text-blue-600">Spendz</span></span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                    The privacy-first financial dashboard that helps you discover your FIRE number and optimize your path to financial freedom.
                </p>
                <p className="text-slate-400 text-xs mt-6">© {new Date().getFullYear()} TrackSpendz. All rights reserved.</p>
            </div>
            <div>
                <h4 className="font-bold text-slate-800 mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                    <li><button onClick={() => setView('features')} className="hover:text-blue-600">Features</button></li>
                    <li><button onClick={() => setView('home')} className="hover:text-blue-600">FIRE Calculator</button></li>
                </ul>
            </div>
            <div>
                <h4 className="font-bold text-slate-800 mb-4">Support & Legal</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                    <li><a href="mailto:support@trackspendz.com" className="hover:text-blue-600">support@trackspendz.com</a></li>
                    <li><button onClick={() => setView('contact')} className="hover:text-blue-600">Contact Us</button></li>
                    <li><button onClick={() => setView('privacy')} className="hover:text-blue-600">Privacy Policy</button></li>
                    <li><button onClick={() => setView('terms')} className="hover:text-blue-600">Terms & Conditions</button></li>
                </ul>
            </div>
        </div>
    </footer>
);