# Apple Developer Account Setup Guide

## Overview
This guide walks through setting up your Apple Developer account and App Store Connect for Wuvo movie rating app deployment.

## Step 1: Apple Developer Program Enrollment

### Requirements
- **Cost**: $99 USD per year
- **Apple ID**: Personal Apple ID (recommended to create a dedicated developer ID)
- **Payment Method**: Credit card for annual fee
- **Business Info**: If enrolling as organization, need legal business documentation

### Enrollment Process
1. **Visit**: [developer.apple.com](https://developer.apple.com)
2. **Sign In**: Use your dedicated Apple ID
3. **Click**: "Enroll" in Apple Developer Program
4. **Choose Entity Type**:
   - **Individual**: For personal/solo developer (recommended for Wuvo)
   - **Organization**: For companies (requires D-U-N-S number)
5. **Complete Payment**: $99 annual fee
6. **Verification**: Apple may take 24-48 hours to verify enrollment

## Step 2: Bundle Identifier Registration

### Register com.wuvo.wuvo
1. **Access**: [developer.apple.com](https://developer.apple.com) → Account → Certificates, Identifiers & Profiles
2. **Click**: Identifiers → App IDs → "+" button
3. **Select**: App (for iOS app)
4. **Configure**:
   - **Description**: Wuvo Movie Rating App
   - **Bundle ID**: Explicit → `com.wuvo.wuvo`
   - **Capabilities**: Select required capabilities (see below)
5. **Register**: Save the bundle identifier

### Required Capabilities
Based on Wuvo's features, enable these capabilities:
- [x] **App Groups** (for sharing data between app extensions if needed)
- [x] **Associated Domains** (for deep linking)
- [x] **Background Modes** (for background app refresh)
- [x] **Data Protection** (for secure data storage)
- [x] **Game Center** (optional - if adding gaming elements)
- [x] **In-App Purchase** (for future premium features)
- [x] **Network Extensions** (for advanced networking)
- [x] **Push Notifications** (for user engagement)
- [x] **Sign In with Apple** (recommended authentication method)

## Step 3: Certificates and Provisioning Profiles

### Development Certificate
1. **Navigate**: Certificates → Development → "+" button  
2. **Select**: iOS App Development
3. **Generate CSR**: Follow instructions to create Certificate Signing Request on your Mac
4. **Upload CSR**: Upload the .certSigningRequest file
5. **Download**: Download and install the certificate

### Distribution Certificate  
1. **Navigate**: Certificates → Production → "+" button
2. **Select**: iOS Distribution (App Store and Ad Hoc)
3. **Generate CSR**: Create new CSR (or reuse existing)
4. **Upload CSR**: Upload the certificate request
5. **Download**: Download and install the certificate

### Provisioning Profiles
**Note**: EAS Build will handle provisioning profiles automatically, but you can create them manually if needed.

1. **Development Profile**:
   - Type: iOS App Development
   - App ID: com.wuvo.wuvo
   - Certificates: Your development certificate
   - Devices: Your test devices

2. **Distribution Profile**:
   - Type: App Store
   - App ID: com.wuvo.wuvo  
   - Certificates: Your distribution certificate

## Step 4: App Store Connect Setup

### Create New App
1. **Access**: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Sign In**: Use your Apple Developer account
3. **Click**: My Apps → "+" → New App
4. **Configure**:
   - **Platforms**: iOS
   - **Name**: Wuvo
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.wuvo.wuvo (select from dropdown)
   - **SKU**: wuvo-1.0 (unique identifier)
   - **User Access**: Full Access

### App Information
1. **Navigate**: App Information section
2. **Complete**:
   - **Subtitle**: Movie Rating & Discovery
   - **Category**: Primary: Entertainment, Secondary: Social Networking
   - **Content Rights**: Check if you have all rights to content
   - **Age Rating**: Complete questionnaire (likely 12+ due to movie content)
   - **App Review Information**: Your contact details

### Pricing and Availability
1. **Navigate**: Pricing and Availability
2. **Configure**:
   - **Price**: Free (initially)
   - **Availability**: All territories (or select specific countries)
   - **App Store Distribution**: Make app available on App Store

## Step 5: EAS Integration with Apple Developer

### Update EAS Configuration
After Apple Developer setup, update your `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-developer-apple-id@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD123456"
      }
    }
  }
}
```

### Find Your Apple Team ID
1. **Visit**: [developer.apple.com](https://developer.apple.com) → Account → Membership
2. **Locate**: Team ID (10-character string like "ABCD123456")
3. **Copy**: This value for EAS configuration

### Find Your App Store Connect App ID
1. **Visit**: [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **Navigate**: My Apps → Wuvo → App Information
3. **Locate**: Apple ID (numeric ID like "1234567890")
4. **Copy**: This value for EAS configuration

## Step 6: Test Account Creation

### Create Demo Account for App Review
1. **Firebase Console**: Create test user account
2. **Credentials**:
   - **Email**: demo@wuvo.app
   - **Password**: DemoAccount123!
3. **Pre-populate**: Add sample movie ratings to demonstrate features
4. **Test**: Verify account works correctly in app

### App Review Information
In App Store Connect → App Review Information:
- **First Name**: Your first name
- **Last Name**: Your last name
- **Phone Number**: Your phone number for Apple to contact you
- **Email**: Your email for App Review team
- **Demo Account**: demo@wuvo.app / DemoAccount123!
- **Review Notes**: See APP_STORE_METADATA.md for detailed notes

## Step 7: Required Legal Documents

### Privacy Policy
- **Requirement**: Must be publicly accessible URL
- **Content**: Use PRIVACY_POLICY.md as template
- **Hosting**: Consider GitHub Pages, Netlify, or dedicated website
- **URL Format**: https://wuvo.app/privacy-policy

### Terms of Service (Optional but Recommended)
- **Purpose**: Protect your app and set user expectations
- **Content**: Define user responsibilities, content policies, etc.
- **Hosting**: Same location as privacy policy

## Step 8: Pre-Submission Checklist

### Apple Developer Account
- [ ] Developer Program enrollment complete ($99 paid)
- [ ] Bundle identifier `com.wuvo.wuvo` registered
- [ ] Development certificate installed
- [ ] Distribution certificate installed
- [ ] Provisioning profiles configured (or EAS managed)

### App Store Connect
- [ ] App created with correct bundle ID
- [ ] App information completed
- [ ] Age rating questionnaire completed
- [ ] Pricing set to Free
- [ ] App Review information filled out
- [ ] Demo account created and tested

### Legal Requirements
- [ ] Privacy Policy written and hosted publicly
- [ ] Terms of Service created (optional)
- [ ] Age rating appropriate for content
- [ ] Copyright information accurate

### EAS Configuration
- [ ] Apple Team ID added to eas.json
- [ ] App Store Connect App ID added to eas.json
- [ ] Apple Developer email configured for submission

## Troubleshooting Common Issues

### "Bundle ID not available"
- Check if bundle ID already exists in your account
- Ensure you're using correct Apple Developer account
- Try slight variation if needed (com.wuvo.wuvo.app)

### "Certificate not found"
- Ensure certificates are properly installed in Keychain
- Check that certificate matches the provisioning profile
- Regenerate certificates if corrupted

### "Provisioning profile expired"
- Provisioning profiles are automatically managed by EAS
- If manual: regenerate with valid certificates and devices

### "App Store Connect access denied"
- Ensure Apple Developer Program enrollment is complete
- Check that annual fee is paid and account is active
- Wait 24-48 hours after enrollment completion

## Costs Summary

### One-Time Setup
- **Apple Developer Program**: $99/year (required)
- **Domain for Privacy Policy**: $10-15/year (optional - can use free hosting)

### Ongoing Costs
- **Apple Developer Program**: $99/year renewal
- **EAS Build Service**: Free tier available, paid tiers for higher usage
- **Firebase**: Free tier sufficient for initial launch

## Timeline Expectations

### Apple Developer Setup
- **Enrollment**: 24-48 hours for verification
- **Bundle ID & Certificates**: Immediate
- **App Store Connect**: Immediate after enrollment

### First App Submission
- **App Review**: 1-7 days (average 24-48 hours)
- **Metadata Review**: Usually approved with app
- **Processing Time**: 24-48 hours after approval

## Next Steps After Setup

1. **Complete EAS Build**: Use updated eas.json with Apple credentials
2. **Create Screenshots**: Use APP_STORE_METADATA.md as guide
3. **Test Build**: Create TestFlight build for internal testing
4. **Submit for Review**: Upload build and submit metadata
5. **Monitor Review**: Respond to any App Review feedback

---

**Important**: Keep your Apple Developer account credentials secure and never share your certificates or private keys. Consider using Apple's Two-Factor Authentication for additional security.