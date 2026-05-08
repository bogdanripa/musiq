interface Props {
  onSignIn: () => void;
}

export function SignIn({ onSignIn }: Props) {
  return (
    <div className="signin">
      <div className="signin-card">
        <h1>🎉 Body's Birthday Playlist</h1>
        <p>Sign in to add songs and vote on the playlist for the party.</p>
        <button className="primary big" onClick={onSignIn}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
