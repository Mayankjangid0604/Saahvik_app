import { useAuthImage } from '@/lib/hooks/useAuthImage';
import LoadingSpinner from './LoadingSpinner';
import { UserCircleIcon } from '@heroicons/react/24/solid';

interface AuthImageProps {
  fileKey: string | null | undefined;
  alt: string;
  className?: string;
  fallbackIcon?: boolean;
}

/**
 * Component that displays an authenticated image using useAuthImage.
 * NEVER use a plain <img src="..."> for authenticated files.
 */
export default function AuthImage({
  fileKey,
  alt,
  className = 'h-16 w-16 rounded-full object-cover',
  fallbackIcon = true,
}: AuthImageProps) {
  const { url, isLoading, error } = useAuthImage(fileKey);

  if (!fileKey || error) {
    if (fallbackIcon) {
      return <UserCircleIcon className={`text-gray-300 ${className}`} />;
    }
    return null;
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (url) {
    return <img src={url} alt={alt} className={className} />;
  }

  return null;
}
