# HPO Portal - Human Phenotype Ontology Search Tool

**HPO Portal** is a lightweight, client‑side web application designed for clinicians, researchers, and geneticists who need quick access to the Human Phenotype Ontology (HPO). It aggregates live data from NIH and JAX APIs to deliver term definitions, hierarchical relationships, associated genes and diseases, and more – all within a responsive and accessible interface.

🌐 **Access Link:** https://hpo-portal.netlify.app

---

## 🔍 Overview

- Browse and search HPO terms in real time
- Open term details in a modal with extensive metadata
- View parent and child terms along with counts
- Inspect associated genes and diseases, then copy them to clipboard
- Build custom term lists and export them as text files (.hpo/.txt)
- Favorites panel offers quick access to common phenotypes
- Fully responsive layout; compliant with accessibility best practices


## 📁 Project Structure

```text
HPO-Portal/
├── index.html          # Single-page interface and modal markup
├── styles.css          # CSS variables, layout, and component styles
├── script.js           # Application logic, event handling, API calls
└── README.md           # Project documentation
```

This repository contains only static assets; no build tools, package managers, or server code are required.


## 🛠 Local Run

1. **Clone the repository**
   ```bash
   git clone https://github.com/muhammadash717/HPO-Portal.git
   cd HPO-Portal
   ```

2. **Run**
   - Open `index.html` directly in your browser, or
   - Serve with a simple HTTP server:
     ```bash
     python -m http.server 8000
     # visit http://localhost:8000
     ```

3. **Interact with the app**
   - Type in the search box to retrieve HPO terms.
   - Click the ℹ️ icon for term details or click the row to select it.
   - Use the modal to copy gene/disease lists or add the term to your selection.
   - Export your selected terms with an optional sample ID.


## 📦 Dependencies & APIs

| Component        | Purpose |
|------------------|---------|
| NIH Clinical Tables HPO API | Search by term name, definitions, synonyms |
| JAX Ontology API              | Retrieve term details, parents/children, annotations |

All network communication is handled with native `fetch()` calls in `script.js`.


## 🎨 Styling & Accessibility

- CSS uses custom properties for color, spacing, and theming.
- `.sr-only` utility class hides text visually but keeps it screen-reader accessible.
- Keyboard focus is supported with `:focus-visible` outlines.
- ARIA roles (`role="dialog"`, `aria-live`, etc.) provide assistive technology support.

## 🤝 Contributing

Contributions are welcome:

- Open an issue for bugs or feature requests.
- Submit pull requests; follow the existing ES6+ style and modular function patterns.

Please ensure any external API keys or sensitive data are **not** committed.


## 📄 License

This project is released under the [MIT License](LICENSE).


---

Made with ❤️ by Muhammad Ashraf