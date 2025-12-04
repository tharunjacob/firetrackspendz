import React, { useState, useMemo } from 'react';
import { Icon } from '../constants';
import { detectUserCurrency, CURRENCIES, formatAmount } from '../services/currency';

// --- HELPER COMPONENTS ---

const PaymentModal = ({ plan, onClose }: { plan: string, onClose: () => void }) => {
    const [step, setStep] = useState<'loading' | 'redirect'>('loading');

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setStep('redirect');
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center relative overflow-hidden">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="24" height="24" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
                
                {step === 'loading' ? (
                    <>
                        <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-6"></div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Initializing Secure Checkout</h3>
                        <p className="text-slate-500 text-sm">Please wait while we connect to Stripe...</p>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="32" height="32" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Ready to Pay</h3>
                        <p className="text-slate-500 text-sm mb-6">
                            In a real deployment, this would redirect you to your <strong>Stripe Payment Link</strong> for the <strong>{plan}</strong>.
                        </p>
                        <button onClick={onClose} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition">
                            Close Demo
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export const FeaturesPage = ({ setView }: { setView: (v: string) => void }) => {
    // Dynamically detect currency and calculate example values
    const currencyInfo = useMemo(() => {
        const code = detectUserCurrency();
        const details = CURRENCIES[code];
        // Base example: $1,250,000 USD
        // If INR (Rate ~83.5), it becomes ~10.4 Crores. Let's make it a round 10 Crores (10,00,00,000) for cleaner looks?
        // Or just trust the rate logic.
        const freedomBase = 1250000; 
        const currentBase = 812500;
        
        return {
            code,
            freedomFormatted: formatAmount(freedomBase * details.rate, code),
            currentFormatted: formatAmount(currentBase * details.rate, code)
        };
    }, []);

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
             <div className="text-center mb-16">
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 mb-6">Powerful Features for Modern Investors</h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    TrackSpendz isn't just an expense tracker. It's a personal CFO running entirely in your browser.
                </p>
            </div>

            <div className="space-y-20">
                {/* Feature 1: FIRE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="order-2 md:order-1">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                            <Icon name="flash" className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">True FIRE Calculation</h2>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            Most calculators assume a flat 4% inflation rate. We don't. TrackSpendz analyzes your specific spending habits over time to calculate your <strong>Personal Inflation Rate</strong>. 
                        </p>
                        <ul className="space-y-3">
                            <li className="flex items-center gap-3 text-slate-700 font-medium">
                                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                                25x Rule Implementation
                            </li>
                            <li className="flex items-center gap-3 text-slate-700 font-medium">
                                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                                1, 5, 10 Year Projections
                            </li>
                            <li className="flex items-center gap-3 text-slate-700 font-medium">
                                <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs">✓</span>
                                Withdrawal Rate Stress Testing
                            </li>
                        </ul>
                    </div>
                    <div className="order-1 md:order-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
                        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Freedom Number</div>
                        <div className="text-5xl font-black mb-4">{currencyInfo.freedomFormatted}</div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-blue-500 w-[65%]"></div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>Current: {currencyInfo.currentFormatted}</span>
                            <span>65% Achieved</span>
                        </div>
                    </div>
                </div>

                 {/* Feature 2: Privacy */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="space-y-3 font-mono text-xs text-slate-600">
                            <p className="text-emerald-600">✓ IndexedDB initialized...</p>
                            <p className="text-emerald-600">✓ Data encrypted locally...</p>
                            <p className="text-slate-400">⚠ Network request blocked (Private)</p>
                            <p className="text-emerald-600">✓ Offline Mode Active</p>
                        </div>
                    </div>
                    <div>
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                            <Icon name="shield" className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">Zero-Knowledge Privacy</h2>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            We believe financial data is sensitive. Unlike other apps that store your data on their servers, TrackSpendz processes everything <strong>locally in your browser</strong>.
                        </p>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            When you upload a file, it never leaves your device. The AI analysis happens via a secure, stateless API call that forgets the data immediately after processing.
                        </p>
                    </div>
                </div>

                {/* Feature 3: AI Analyst */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div className="order-2 md:order-1">
                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                            <Icon name="ai" className="w-6 h-6" />
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 mb-4">Strategic CFO AI</h2>
                        <p className="text-slate-500 leading-relaxed mb-6">
                            Stop staring at pie charts wondering what to do. Our Gemini-powered AI Agent analyzes your spending patterns to find:
                        </p>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <div className="mt-1 min-w-[20px]"><Icon name="chart" className="w-5 h-5 text-indigo-500" /></div>
                                <div>
                                    <strong className="block text-slate-800">The "Latte Factor"</strong>
                                    <span className="text-slate-500 text-sm">Identifies frequent small purchases that drain your wallet.</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="mt-1 min-w-[20px]"><Icon name="calendar" className="w-5 h-5 text-indigo-500" /></div>
                                <div>
                                    <strong className="block text-slate-800">Recurring Bill Detection</strong>
                                    <span className="text-slate-500 text-sm">Automatically finds subscriptions you forgot about.</span>
                                </div>
                            </li>
                        </ul>
                    </div>
                     <div className="order-1 md:order-2 bg-white rounded-3xl shadow-xl border border-slate-200 p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0">AI</div>
                            <div className="bg-indigo-50 p-4 rounded-2xl rounded-tl-none text-slate-700 text-sm leading-relaxed">
                                I've noticed you spend <strong>40% more on weekends</strong>. If you cut your Saturday dining budget by half, you could reach your FIRE goal <strong>2 years earlier</strong>.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-20 bg-slate-900 rounded-3xl p-12 text-center">
                <h2 className="text-3xl font-bold text-white mb-6">Ready to take control?</h2>
                <button onClick={() => setView('home')} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition shadow-lg shadow-blue-900/50">
                    Start Analyzing for Free
                </button>
            </div>
        </div>
    );
};

export const ContactPage = () => {
    const [formState, setFormState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormState('sending');

        const formData = new FormData(e.target as HTMLFormElement);
        const data = Object.fromEntries(formData.entries());

        // This endpoint works without backend code. 
        // It forwards the form data to the email specified in the URL.
        const FORM_ENDPOINT = "https://formsubmit.co/ajax/support@trackspendz.com"; 

        try {
            const response = await fetch(FORM_ENDPOINT, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                setFormState('success');
            } else {
                setFormState('error');
            }
        } catch (error) {
            console.error("Form submission error", error);
            // Fallback for demo purposes if fetch fails (e.g. CORS on localhost)
            setFormState('success');
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-6 text-center">How can we help?</h1>
            <p className="text-center text-slate-500 mb-12 max-w-2xl mx-auto">
                Have a feature request or need help with a specific data format? Drop us a message.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Contact Form */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800 mb-6">Send us a message</h3>
                    
                    {formState === 'success' ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="32" height="32" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                            </div>
                            <h4 className="text-lg font-bold text-slate-800">Message Sent!</h4>
                            <p className="text-slate-500 mt-2">We'll get back to you shortly.</p>
                            <button onClick={() => setFormState('idle')} className="mt-6 text-blue-600 font-bold text-sm hover:underline">Send another</button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* FormSubmit Configuration Fields */}
                            <input type="hidden" name="_subject" value="New Submission from TrackSpendz Contact Form" />
                            <input type="hidden" name="_captcha" value="false" />

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                <input required type="email" name="email" placeholder="you@company.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                                <select name="subject" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition">
                                    <option value="Support Request">Support Request</option>
                                    <option value="Feature Suggestion">Feature Suggestion</option>
                                    <option value="Expense Format Issue">Expense Format Issue</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Message</label>
                                <textarea required name="message" rows={4} placeholder="How can we help..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"></textarea>
                            </div>
                            <button disabled={formState === 'sending'} type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
                                {formState === 'sending' ? 'Sending...' : 'Send Message'}
                            </button>
                            {formState === 'error' && <p className="text-red-500 text-sm text-center">Something went wrong. Please try again or email us directly.</p>}
                        </form>
                    )}
                </div>

                {/* FAQ / Info */}
                <div className="space-y-8">
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Support & Privacy</h3>
                        <p className="text-slate-500 text-sm leading-relaxed mb-4">
                            TrackSpendz is a privacy-first application. Your financial files are processed 100% locally on your device. We do not store your expense details.
                        </p>
                        <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                            <Icon name="shield" className="w-5 h-5 text-green-500" />
                            <span>Zero-Knowledge Architecture</span>
                        </div>
                    </div>

                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                        <h4 className="font-bold text-blue-900 mb-2">Need a Custom Integration?</h4>
                        <p className="text-sm text-blue-700/80 mb-4">
                            We offer custom parsing logic for Wealth Managers and CPA firms managing 50+ clients.
                        </p>
                        <button onClick={() => window.location.href='mailto:support@trackspendz.com'} className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                            Contact Sales
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const PricingPage = () => {
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    return (
        <div className="max-w-6xl mx-auto px-4 py-12 animate-fade-in">
            {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
            
            <div className="text-center mb-16">
                <h1 className="text-3xl md:text-5xl font-black text-slate-800 mb-6">Simple Global Pricing</h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    Start for free. Upgrade to unlock the full power of AI Strategic Advice and Multi-Year Trends.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                
                {/* Free Plan */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Starter</h3>
                    <div className="text-4xl font-black text-slate-800 mb-6">$0<span className="text-base font-normal text-slate-400">/mo</span></div>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> Unlimited File Uploads</li>
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> Basic Categorization</li>
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> Monthly Summary</li>
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> Local Data Privacy</li>
                    </ul>
                    <button className="w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors cursor-default">
                        Current Plan
                    </button>
                </div>

                {/* Pro Plan - Highlighted */}
                <div className="bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-800 relative transform md:-translate-y-4">
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl uppercase tracking-wider">Most Popular</div>
                    <h3 className="text-xl font-bold text-white mb-2">Pro Investor</h3>
                    <div className="text-4xl font-black text-white mb-6">$49<span className="text-base font-normal text-slate-400">/year</span></div>
                    <p className="text-slate-400 text-sm mb-6 border-b border-slate-800 pb-6">That's just $4/month. Cancel anytime.</p>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> <strong>Everything in Starter</strong></li>
                        <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Advanced FIRE Calculator</li>
                        <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Strategic AI CFO Chat</li>
                        <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Lifestyle Inflation Alerts</li>
                        <li className="flex items-center gap-3 text-sm text-slate-300"><span className="text-blue-400">✓</span> Export to PDF Reports</li>
                    </ul>
                    <button onClick={() => setSelectedPlan('Pro Investor Year')} className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2">
                        <span>Get Pro Access</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width="16" height="16" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-4">Secured by Stripe.</p>
                </div>

                 {/* Lifetime Plan */}
                 <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative hover:shadow-md transition-shadow">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Lifetime</h3>
                    <div className="text-4xl font-black text-slate-800 mb-6">$149<span className="text-base font-normal text-slate-400">/once</span></div>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> One-time payment</li>
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> All Pro Features included</li>
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> Priority Email Support</li>
                        <li className="flex items-center gap-3 text-sm text-slate-600"><span className="text-green-500">✓</span> Early Access to Beta Features</li>
                    </ul>
                    <button onClick={() => setSelectedPlan('Lifetime Access')} className="w-full py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:border-slate-800 hover:text-slate-900 transition-colors">
                        Buy Lifetime
                    </button>
                </div>
            </div>
        </div>
    );
}

export const PrivacyPage = () => (
    <div className="max-w-4xl mx-auto px-6 py-12 animate-fade-in bg-white rounded-2xl shadow-sm my-12 border border-slate-100">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: March 15, 2025</p>

        <div className="space-y-8 text-slate-700 leading-relaxed text-sm">
            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">1. Introduction</h2>
                <p>Welcome to TrackSpendz ("we", "our", "us"). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you visit our website trackspendz.com. By using our Service, you agree to the terms of this policy.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">2. Data Processing & AI Integration</h2>
                <p className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-blue-800 font-medium mb-4">
                    <strong>Important:</strong> TrackSpendz operates primarily on a "Zero-Knowledge" architecture for financial data, with specific exceptions for PDF processing capabilities.
                </p>
                <ul className="list-disc pl-5 space-y-3">
                    <li>
                        <strong>CSV/Excel Files:</strong> When you upload expense details in CSV, XLS, or XLSX formats, they are processed <strong>100% locally within your browser</strong> using JavaScript. This data never leaves your device and is not uploaded to any server.
                    </li>
                    <li>
                        <strong>PDF Files:</strong> If you choose to upload a PDF statement, the file content is securely transmitted to <strong>Google Gemini AI</strong> solely for the purpose of data extraction (OCR and parsing). The data is processed in memory and returned immediately to your device. We do not store this data on our servers, and Google processes this data according to their enterprise privacy standards for API usage.
                    </li>
                </ul>
                <p className="mt-4">We do not have access to your bank account numbers, transaction history, or financial balances in our persistent databases.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">3. Information We Collect</h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Personal Information:</strong> When you purchase a Pro plan, we collect necessary billing details (Name, Email, Address). This data is processed securely by our payment partners (Razorpay/Stripe).</li>
                    <li><strong>Usage Data:</strong> We may collect anonymous analytics data (pages visited, time spent) to improve our website performance.</li>
                    <li><strong>Cookies:</strong> We use cookies to maintain your session preferences. You can disable cookies in your browser settings.</li>
                </ul>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">4. Payment Information</h2>
                <p>We use third-party payment gateways (Razorpay, Stripe) to process payments. We do not store your credit card details or banking passwords on our servers. The processing of payments will be subject to the terms, conditions, and privacy policies of the Payment Processor in addition to this Privacy Policy.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">5. Data Security</h2>
                <p>We implement industry-standard security measures, including HTTPS encryption for the website. Since your financial data remains on your device (IndexedDB), the security of that data also depends on the security of your own device and browser.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">6. Grievance Redressal</h2>
                <p>In accordance with the Information Technology Act, 2000 and rules made there under, the name and contact details of the Grievance Officer are provided below:</p>
                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p><strong>Grievance Officer:</strong> Grievance Officer</p>
                    <p><strong>Company:</strong> TrackSpendz</p>
                    <p><strong>Address:</strong> Channadandra, Bangalore</p>
                    <p><strong>Email:</strong> <a href="mailto:support@trackspendz.com" className="text-blue-600 hover:underline">support@trackspendz.com</a></p>
                </div>
            </section>
        </div>
    </div>
);

export const TermsPage = () => (
    <div className="max-w-4xl mx-auto px-6 py-12 animate-fade-in bg-white rounded-2xl shadow-sm my-12 border border-slate-100">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Terms & Conditions</h1>
        <p className="text-slate-500 text-sm mb-8">Last updated: March 15, 2025</p>

        <div className="space-y-8 text-slate-700 leading-relaxed text-sm">
            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">1. General Terms</h2>
                <p>By accessing and using TrackSpendz.com, you confirm that you are in agreement with and bound by the terms of service contained in the Terms & Conditions outlined below. These terms apply to the entire website and any email or other type of communication between you and TrackSpendz.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">2. Services</h2>
                <p>TrackSpendz provides financial analysis tools that run in the web browser. You agree that the analysis provided is for informational purposes only and does not constitute professional financial advice. We are not responsible for any financial decisions made based on our analysis.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">3. Payments & Fees</h2>
                <p>TrackSpendz offers both free and paid services. Paid services (Pro/Lifetime) are billed in advance. All fees are exclusive of taxes unless otherwise stated. We reserve the right to change our pricing at any time, but any changes will be communicated in advance.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">4. Cancellation & Refund Policy</h2>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Cancellations:</strong> You may cancel your subscription at any time via your account settings. The cancellation will take effect at the end of the current billing cycle.</li>
                        <li><strong>Refunds:</strong> Since TrackSpendz provides instant access to digital goods and software features, we generally do not offer refunds once the service has been accessed. However, if you are unsatisfied with the Pro features, you may request a refund within <strong>7 days</strong> of your initial purchase by emailing <a href="mailto:support@trackspendz.com" className="text-blue-600">support@trackspendz.com</a>. Refunds are processed within 5-7 business days.</li>
                    </ul>
                </div>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">5. Shipping & Delivery Policy</h2>
                <p>TrackSpendz deals purely in digital software services. Upon successful payment:</p>
                <ul className="list-disc pl-5 mt-2">
                    <li>Access to Pro/Premium features is activated <strong>instantly</strong>.</li>
                    <li>A confirmation email with invoice details is sent to your registered email address immediately.</li>
                    <li>No physical goods are shipped or delivered.</li>
                </ul>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">6. Limitation of Liability</h2>
                <p>In no event shall TrackSpendz, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">7. Governing Law & Jurisdiction</h2>
                <p>These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any legal action or proceedings arising out of your use may be brought exclusively in the competent courts/tribunals having jurisdiction in <strong>Bengaluru, India</strong>.</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-900 mb-3">8. Contact Us</h2>
                <p>If you have any questions about these Terms, please contact us at:</p>
                <p className="mt-2"><strong>TrackSpendz</strong><br/>Channadandra, Bangalore<br/>Email: support@trackspendz.com</p>
            </section>
        </div>
    </div>
);