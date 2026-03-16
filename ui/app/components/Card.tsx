import React from "react";
import { Flex, Surface } from "@dynatrace/strato-components/layouts";
import { Link } from "@dynatrace/strato-components/typography";
import { Link as RouterLink } from "react-router-dom";

type CardProps = {
  /** Absolute or relative link for the Card */
  href: string;
  /** The src for the image to show. */
  imgSrc: string;
  /** The name for the Card to show below the image. */
  name: string;
  /** Is the link target in the app? default: false */
  inAppLink?: boolean;
};

export const Card = ({ href, inAppLink, imgSrc, name }: CardProps) => {
  const content = (
    <Flex flexDirection="column" alignItems="center" gap={24}>
      <img src={imgSrc} alt={name} height="100px" width="100px" />
      {name}
    </Flex>
  );

  return (
    <Surface
      elevation="raised"
      padding={24}
      style={{
        width: 210,
        height: 210,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      {inAppLink ? (
        <Link as={RouterLink} to={href}>
          {content}
        </Link>
      ) : (
        <Link target="_blank" href={href} rel="noopener noreferrer">
          {content}
        </Link>
      )}
    </Surface>
  );
};
