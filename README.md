# TrackSpendz - FIRE Calculator & Financial Analyst

<div align="center">
  <h3>Privacy-First Financial Dashboard with AI-Powered Insights</h3>
  <p>Calculate your FIRE number, track expenses, and get strategic financial advice</p>
</div>

## 🚀 Features

- **FIRE Calculator**: Calculate your Financial Independence number using the 25x rule with personal inflation rate
- **AI-Powered Categorization**: Automatically categorize transactions using Google Gemini AI
- **Multi-Entity Support**: Track expenses for multiple family members or accounts
- **Rich Visualizations**: Interactive charts and graphs for income, expenses, and trends
- **100% Private**: All data processing happens locally in your browser
- **PDF Export**: Generate comprehensive financial snapshots
- **Smart Insights**: Detect recurring subscriptions and spending patterns

## 🛠️ Tech Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **Recharts** for data visualization
- **Google Gemini AI** for intelligent categorization
- **IndexedDB** for local data storage
- **Tailwind CSS** for styling

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/tharunjacob/firetrackspendz.git
   cd firetrackspendz
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory:
   ```env
   VITE_API_KEY=your_gemini_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open your browser to `http://localhost:3000`

## 🚢 Deployment to Vercel

### Option 1: Deploy via Vercel Dashboard

1. Push your code to GitHub (see instructions below)
2. Go to [Vercel](https://vercel.com) and sign in
3. Click "New Project"
4. Import your GitHub repository: `tharunjacob/firetrackspendz`
5. Add environment variable:
   - Name: `VITE_API_KEY`
   - Value: Your Gemini API key
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
npm i -g vercel
vercel
```

Follow the prompts and add your `VITE_API_KEY` when asked.

## 📝 Usage

1. **Upload Financial Data**: Upload CSV/Excel files from your bank or expense tracking apps
2. **Review & Edit**: Use the Data tab to review and edit transactions
3. **View Analytics**: Explore various views (Summary, Yearly, Monthly, Trends)
4. **Calculate FIRE**: Check the FIRE Calculator tab to see your retirement number
5. **Get AI Advice**: Use the AI Chat tab for personalized financial strategies

## 🔒 Privacy

- All data is stored locally in your browser using IndexedDB
- No data is sent to external servers except for AI categorization (which only sends transaction descriptions)
- You can backup and restore your data anytime
- Clear all data with one click

## 📄 License

This project is private and proprietary.

## 🤝 Contributing

This is a personal project, but suggestions and feedback are welcome!

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for financial freedom
