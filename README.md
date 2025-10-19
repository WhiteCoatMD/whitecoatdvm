# WhiteCoat DVM - TeleVet Services Platform

WhiteCoat DVM is a professional telemedicine platform that connects pet owners with licensed veterinarians through secure video consultations. The platform offers subscription-based access to unlimited veterinary consultations, covering up to 6 pets per household.

## Features

- **Unlimited Consultations**: 24/7 access to licensed veterinarians
- **Multi-Pet Coverage**: Support for up to 6 pets per subscription
- **Multiple Subscription Plans**: Monthly, 90-day, 6-month, and yearly options
- **Secure Payment Processing**: Stripe integration for subscription management
- **User Portal**: Comprehensive dashboard for managing pets, consultations, and billing
- **TeleTails Integration**: Seamless connection to professional veterinary consultation platform
- **Refund Policy**: 24-hour satisfaction guarantee
- **Affiliate Program**: Partnership opportunities for pet rescues and shelters

## Tech Stack

### Frontend
- **HTML5**: Semantic markup for all pages
- **CSS3**: Custom styling with responsive design
  - `styles.css` - Main application styles
  - `portal.css` - Portal-specific styles
- **JavaScript (Vanilla)**: Client-side interactivity
  - `registration.js` - Multi-step registration form
  - `portal.js` - Portal dashboard functionality
- **Google Fonts**: Inter font family for typography
- **Responsive Design**: Mobile-friendly interface with adaptive navigation

### Backend
- **Node.js**: Serverless runtime environment
- **Vercel Serverless Functions**: API endpoints hosted as serverless functions
  - `/api/create-subscription.js` - Stripe subscription creation
  - `/api/authenticate.js` - User authentication via Google Sheets
  - `/api/validate-coupon.js` - Discount code validation
  - `/api/stripe-webhook.js` - Stripe webhook handler
  - `/api/change-password.js` - Password change functionality
  - `/api/test.js` - API testing endpoint

### Payment Processing
- **Stripe API**: Payment and subscription management
  - Subscription creation and management
  - Payment method handling
  - 3D Secure authentication support
  - Webhook event processing
  - Coupon/discount code support

### Data Storage
- **Google Sheets**: User database and authentication
  - CSV export for public access
  - Google Sheets API fallback
  - Flexible header matching for data retrieval

### Hosting & Deployment
- **Vercel**: Static site and serverless function hosting
  - Automatic deployments
  - Environment variable management
  - Custom security headers (CSP, X-Frame-Options, etc.)
  - CORS configuration

### Third-Party Integrations
- **TeleTails**: Veterinary consultation platform
  - Partner platform for video consultations
  - Integration URL: `https://care-web.teletails.com/WCPDVM`

### Security
- **Content Security Policy (CSP)**: Strict content loading policies
- **Security Headers**:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block
  - Referrer-Policy: strict-origin-when-cross-origin
- **HTTPS Enforcement**: All traffic over secure connections
- **Client-side Session Management**: localStorage-based authentication

## Project Structure

```
WhiteCoatDVM/
├── api/                          # Vercel serverless functions
│   ├── authenticate.js           # User authentication
│   ├── change-password.js        # Password management
│   ├── create-subscription.js    # Stripe subscription creation
│   ├── stripe-webhook.js         # Stripe webhook handler
│   ├── test.js                   # Testing endpoint
│   └── validate-coupon.js        # Coupon validation
├── public/                       # Static assets
│   ├── WhiteCoatdvmlogo.png      # Logo
│   ├── televetconsult.png        # Hero image
│   ├── happypetowner.png         # Contact section image
│   └── shelterpartner.png        # Affiliate section image
├── admin.html                    # Admin dashboard
├── change-password.html          # Password change page
├── index.html                    # Landing page
├── login.html                    # Login page
├── portal.html                   # User portal dashboard
├── refund-policy.html            # Refund policy page
├── signup.html                   # Registration page
├── portal.css                    # Portal styles
├── portal.js                     # Portal functionality
├── registration.js               # Registration form logic
├── styles.css                    # Main application styles
├── package.json                  # Node.js dependencies
├── vercel.json                   # Vercel configuration
└── favicon.ico                   # Site favicon
```

## Pages

1. **index.html** - Landing page with services, pricing, FAQ, and affiliate info
2. **signup.html** - Multi-step registration with Stripe payment integration
3. **login.html** - User authentication
4. **portal.html** - User dashboard with pet management, consultations, and billing
5. **change-password.html** - Password management
6. **refund-policy.html** - 24-hour refund policy details
7. **admin.html** - Administrative dashboard

## Subscription Plans

- **Monthly Plan**: $24.99/month (First month $5)
- **90-Day Plan**: $39.99/90 days (Save $35)
- **6-Month Plan**: $69.99/6 months (Save $80)
- **Yearly Plan**: $79.99/year (Save $220)

All plans include:
- Unlimited consultations
- Up to 6 pets covered
- Licensed veterinarians
- Secure video calls
- On-demand access
- Digital health records
- Follow-up support

## Setup & Installation

### Prerequisites
- Node.js (v14 or higher)
- Vercel account
- Stripe account
- Google Sheets with user data

### Environment Variables
Create a `.env` file or configure in Vercel dashboard:

```env
STRIPE_SECRET_API=sk_live_...
GOOGLE_SHEETS_API_KEY=your_api_key_here
```

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project directory
cd WhiteCoatDVM

# Install dependencies
npm install

# Run development server
npm run dev
```

### Deployment

The project is configured for automatic deployment on Vercel:

```bash
# Deploy to Vercel
vercel --prod
```

## Development

- **Local Development**: `npm run dev` (uses Vercel CLI)
- **Build**: `npm run build` (currently just echoes completion)

## API Endpoints

### POST /api/authenticate
Authenticates users against Google Sheets database.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /api/create-subscription
Creates a Stripe subscription.

**Request:**
```json
{
  "paymentMethodId": "pm_...",
  "priceId": "price_...",
  "plan": "monthly",
  "customerData": {
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "555-1234"
  },
  "couponId": "DISCOUNT20" // optional
}
```

### POST /api/validate-coupon
Validates discount codes.

### POST /api/stripe-webhook
Handles Stripe webhook events.

### POST /api/change-password
Updates user password.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

MIT

## Author

WhiteCoat DVM

## Contact

For support or inquiries, visit the contact section on the website.
