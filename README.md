# TrackSpendz - AI Financial Analyst & FIRE Calculator

**TrackSpendz** is a privacy-first, browser-based financial dashboard. It transforms messy bank statements (PDF, CSV, Excel) into standardized data, categorizes expenses using local logic + AI, and provides advanced analytics like **Personal Inflation Rate** and **FIRE (Financial Independence, Retire Early)** projections.

![TrackSpendz Dashboard](https://trackspendz.com/og-image.png)

## 🚀 Key Features

*   **Zero-Knowledge Architecture:** Financial data (CSV/Excel) is processed entirely in the browser using IndexedDB. No data is stored on our servers.
*   **Universal File Support:** Drag and drop files from any bank.
    *   **CSV/Excel:** Auto-detects headers and structures.
    *   **PDF:** Uses Google Gemini AI (via secure stateless API) to extract transactions from PDF statements.
*   **Smart Categorization:**
    *   Includes a dictionary of 200+ global merchants (Walmart, Uber, Tesco, Swiggy, Amazon, etc.).
    *   Learn-as-you-go: Correct a category once, and the app remembers it for future uploads.
    *   **AI Smart Fill:** Use LLMs to bulk-categorize unclassified transactions.
*   **FIRE Engine:**
    *   Calculates your *personal* inflation rate based on your historical spending (not national averages).
    *    projects your "Freedom Number" (25x Rule) dynamically.
*   **Transfer Detection:** Automatically identifies transfers between your own accounts to prevent double-counting expenses.
*   **Global Context:** Supports multi-currency symbols ($, €, £, ₹) and international date formats.

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **Data Visualization:** Recharts
*   **Parsing:** SheetJS (XLSX), PDF extraction via Google Gemini API
*   **State/Storage:** React Hooks + IndexedDB (Local Storage)
*   **AI:** @google/genai SDK

## 📦 Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/trackspendz.git
    cd trackspendz
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Create a `.env` file in the root directory. You need a Google Gemini API Key for the PDF extraction and AI Chat features.
    ```env
    VITE_API_KEY=your_google_gemini_api_key_here
    ```
    *Get a key at [Google AI Studio](https://aistudio.google.com/).*

4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

5.  **Build for Production:**
    ```bash
    npm run build
    ```

## 🔒 Privacy & Security

*   **Local Processing:** CSV and Excel files are parsed using JavaScript libraries running in your browser. The raw data stays in your RAM and IndexedDB.
*   **PDF Parsing:** If you upload a PDF, the file content is sent to the Google Gemini API for OCR/Extraction. The prompt is stateless; we do not store the data, and we instruct the model to return only structured data.
*   **Persistence:** Data is saved to your browser's IndexedDB so it persists between refreshes, but clearing your browser cache will wipe the data.

## 🌍 Global Support
The application includes keyword mapping for major brands across:
*   🇺🇸 USA (Walmart, Target, Costco, Venmo, Zelle)
*   🇬🇧 UK (Tesco, Sainsbury's, TFL, Faster Payments)
*   🇪🇺 Europe (Carrefour, Aldi, SEPA)
*   🇮🇳 India (Swiggy, Zomato, UPI, NEFT)

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

[MIT](https://choosealicense.com/licenses/mit/)