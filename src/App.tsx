    {authOpen && <div className="overlay"><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" type="button" onClick={()=>{if(passwordResetMode!=="update") { setAuthOpen(false); setPasswordResetMode(null); }}} disabled={passwordResetMode==="update"}>×</button>
      {passwordResetMode==="request" ? <>
        <h2>Forgot password?</h2>
        <p className="auth-hint">Enter the email address linked to your account. We'll send you a secure password reset link.</p>
        <form onSubmit={requestPasswordReset}>
          <label>Email Address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address"/></label>
          <button className="btn primary full" disabled={passwordResetBusy}>{passwordResetBusy?"Sending reset link…":"Send reset link"}</button>
        </form>
        <button type="button" className="switch auth-back-link" onClick={()=>{setPasswordResetMode(null);setNotice("");}}>Back to login</button>
      </> : passwordResetMode==="update" ? <>
        <h2>Set a new password</h2>
        <p className="auth-hint">Choose a new password for your VPN Products and Services account.</p>
        <form onSubmit={savePasswordReset}>
          <label>New Password<input required minLength={8} type="password" autoComplete="new-password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          <label>Confirm New Password<input required minLength={8} type="password" autoComplete="new-password" value={confirmResetPassword} onChange={e=>setConfirmResetPassword(e.target.value)} placeholder="Re-enter your new password"/></label>
          <button className="btn primary full" disabled={passwordResetBusy}>{passwordResetBusy?"Updating password…":"Update password"}</button>
        </form>
      </> : <>
        <h2>{mode==="login"?"Welcome back":"Create an account"}</h2>
        <form key={mode} autoComplete={mode==="login"?"on":"off"} onSubmit={authenticate}>
          {mode==="signup" && <label>Full Name<input required type="text" name="signup-full-name" autoComplete="name" maxLength={80} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Enter your full name"/></label>}
          <label>Email Address<input required type="email" name={mode==="login"?"username":"signup-email"} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter your email address"/></label>
          <label>Password<input required minLength={8} name={mode==="login"?"password":"signup-new-password"} autoComplete={mode==="login"?"current-password":"new-password"} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>
          {mode==="signup" && <label>Confirm Password<input required minLength={8} name="signup-confirm-password" autoComplete="new-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your password (minimum 8 characters)"/></label>}
          <button className="btn primary full">{mode==="login"?"Sign in":"Create account"}</button>
          {mode==="signup" && <p className="auth-hint">Register using your email address. We'll send you a confirmation link before you can sign in.</p>}
        </form>
        {mode==="login" && <button type="button" className="switch auth-forgot-link" onClick={()=>{setPasswordResetMode("request");setShowResendConfirmation(false);setNotice("");}}>Forgot password?</button>}
        {mode==="login" && showResendConfirmation && <button type="button" className="switch" onClick={resendEmailConfirmation}>Resend confirmation email</button>}
        <button type="button" className="switch" onClick={()=>{setMode(mode==="login"?"signup":"login");setPasswordResetMode(null);setShowResendConfirmation(false);setEmail("");setPassword("");setConfirmPassword("");setFullName("");}}>{mode==="login"?"New user? Create an account":"Already registered? Sign in"}</button>
      </>}
    </div></div>}